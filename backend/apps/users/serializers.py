from rest_framework import serializers
from .models import User, Notification

class UserSerializer(serializers.ModelSerializer):
    # Hasło oznaczamy jako write_only, aby po stworzeniu użytkownika API nigdy nie zwracało go w odpowiedzi
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['user_id', 'username', 'password', 'full_name', 'role', 'is_active']
        read_only_fields = ['user_id']

    def create(self, validated_data):
        # KLUCZOWE MIEJSCE: create_user() automatycznie haszuje hasło algorytmem PBKDF2 w Django
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            full_name=validated_data.get('full_name', ''),
            role=validated_data.get('role', 'baker'),
            is_active=validated_data.get('is_active', True)
        )
        return user


class NotificationSerializer(serializers.ModelSerializer):
    sender_id = serializers.IntegerField(source='sender.user_id', read_only=True, allow_null=True, default=None)
    sender_name = serializers.CharField(source='sender.full_name', read_only=True, allow_null=True, default=None)

    class Meta:
        model = Notification
        fields = ['id', 'title', 'message', 'is_read', 'created_at', 'sender_id', 'sender_name']
        read_only_fields = fields