from drf_spectacular.contrib.rest_framework_simplejwt import SimpleJWTScheme


class PasswordChangeAwareJWTScheme(SimpleJWTScheme):
    target_class = 'users.authentication.PasswordChangeAwareJWTAuthentication'