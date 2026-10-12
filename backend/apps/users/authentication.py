from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.authentication import JWTAuthentication


class PasswordChangeRequired(PermissionDenied):
    default_detail = {'detail': 'Najpierw ustaw własne hasło.', 'code': 'password_change_required'}


class PasswordChangeAwareJWTAuthentication(JWTAuthentication):
    ALLOWED_URL_NAMES = {'current-user', 'change-initial-password'}

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None
        user, _ = result
        match = getattr(request._request, 'resolver_match', None)
        if user.must_change_password and (match is None or match.url_name not in self.ALLOWED_URL_NAMES):
            raise PasswordChangeRequired()
        return result