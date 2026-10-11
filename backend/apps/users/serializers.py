from django.contrib.auth import password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from .models import User, Notification
from .tokens import revoke_refresh_tokens

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['user_id', 'username', 'password', 'full_name', 'role', 'is_active']
        read_only_fields = ['user_id']

    def validate(self, attrs):
        password = attrs.get('password')
        if password:
            user = self.instance or User(username=attrs.get('username', ''))
            try:
                password_validation.validate_password(password, user)
            except DjangoValidationError as exc:
                raise serializers.ValidationError({'password': list(exc.messages)})
        return attrs

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            full_name=validated_data.get('full_name', ''),
            role=validated_data.get('role', 'baker'),
            is_active=validated_data.get('is_active', True)
        )
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        was_active = instance.is_active
        user = super().update(instance, validated_data)
        if password:
            user.set_password(password)
            user.save(update_fields=['password'])
        if password or (was_active and not user.is_active):
            revoke_refresh_tokens(user)
        return user

class NotificationSerializer(serializers.ModelSerializer):
    sender_id = serializers.IntegerField(source='sender.user_id', read_only=True, allow_null=True, default=None)
    sender_name = serializers.CharField(source='sender.full_name', read_only=True, allow_null=True, default=None)

    class Meta:
        model = Notification
        fields = ['id', 'title', 'message', 'is_read', 'created_at', 'sender_id', 'sender_name']
        read_only_fields = fields