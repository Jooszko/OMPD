from drf_spectacular.utils import OpenApiResponse
from rest_framework import serializers

from .serializers import NotificationSerializer


class LoginInputSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()


class LoginResultSerializer(serializers.Serializer):
    access = serializers.CharField(help_text='Token dostępu (ważny 30 minut) – nagłówek Authorization: Bearer <token>.')
    refresh = serializers.CharField(help_text='Token odświeżania (ważny 7 dni).')
    must_change_password = serializers.BooleanField(help_text='Konto ma hasło tymczasowe do zmiany.')
    role = serializers.CharField()


class LoginErrorSerializer(serializers.Serializer):
    error = serializers.CharField()
    code = serializers.ChoiceField(['invalid_credentials', 'account_inactive', 'too_many_attempts'])


class ChangePasswordInputSerializer(serializers.Serializer):
    new_password = serializers.CharField()


class TokenPairSerializer(serializers.Serializer):
    access = serializers.CharField()
    refresh = serializers.CharField()


class NotificationListSerializer(serializers.Serializer):
    results = NotificationSerializer(many=True, help_text='Najnowsze 200 powiadomień.')
    unread_count = serializers.IntegerField()


class SendMessageInputSerializer(serializers.Serializer):
    recipient_id = serializers.IntegerField()
    title = serializers.CharField()
    message = serializers.CharField()


VALIDATION_ERROR = OpenApiResponse(description='Błędy walidacji: słownik pole → lista komunikatów.')