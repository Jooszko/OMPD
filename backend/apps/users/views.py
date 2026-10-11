from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .models import User, Notification
from .serializers import UserSerializer, NotificationSerializer
from .permissions import IsAdminRole, IsAdminRoleOrReadOnly
from django.core.cache import cache
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth import password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework_simplejwt.tokens import RefreshToken
from .tokens import revoke_refresh_tokens
from django.db import transaction
from audit.services import field_changes, record_event

class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class UserListCreateView(APIView):
    permission_classes = [IsAdminRoleOrReadOnly]

    def get(self, request):
        users = User.objects.all()
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = UserSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            user = serializer.save()
            record_event(
                request, category='accounts', action='user.created', obj=user, object_label=user.full_name,
                description=f'Założono konto {user.full_name} (login {user.username}, {user.get_role_display()}).',
            )
        return Response(serializer.data, status=status.HTTP_201_CREATED)


USER_AUDIT_LABELS = {
    'username': 'Login',
    'full_name': 'Imię i nazwisko',
    'role': 'Rola',
    'is_active': 'Konto aktywne',
}


def _user_state(user):
    return {
        'username': user.username,
        'full_name': user.full_name,
        'role': user.get_role_display(),
        'is_active': user.is_active,
    }


class UserDetailView(APIView):
    permission_classes = [IsAdminRole]

    def put(self, request, pk):
        user = get_object_or_404(User, pk=pk)
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)

        if not data.get('password'):
            data.pop('password', None)

        if user.pk == request.user.pk and (data.get('role', user.role) != 'admin' or data.get('is_active') is False):
            return Response(
                {'error': 'Nie możesz odebrać sobie roli administratora ani dezaktywować własnego konta.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = UserSerializer(user, data=data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        before = _user_state(user)
        with transaction.atomic():
            saved = serializer.save()
            changes = field_changes(before, _user_state(saved), USER_AUDIT_LABELS)
            if changes:
                record_event(
                    request, category='accounts', action='user.updated', obj=saved, object_label=saved.full_name,
                    description=f'Zmieniono dane konta {saved.full_name}.', changes=changes,
                )
            if 'password' in data:
                record_event(
                    request, category='accounts', action='user.password_reset', obj=saved,
                    object_label=saved.full_name,
                    description=(
                        f'Ustawiono hasło tymczasowe dla konta {saved.full_name}. '
                        'Pracownik zmieni je przy następnym logowaniu.'
                    ),
                )
        return Response(UserSerializer(saved).data, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        user = get_object_or_404(User, pk=pk)
        if user.pk == request.user.pk:
            return Response({'error': 'Nie możesz usunąć własnego konta.'}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            record_event(
                request, category='accounts', action='user.deleted', obj=user, object_label=user.full_name,
                description=f'Usunięto konto {user.full_name} (login {user.username}, {user.get_role_display()}).',
            )
            user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        notifications = Notification.objects.filter(user=request.user).select_related('sender')[:200]
        serializer = NotificationSerializer(notifications, many=True)
        return Response({
            'results': serializer.data,
            'unread_count': Notification.objects.filter(user=request.user, is_read=False).count(),
        })


class NotificationMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        notification = get_object_or_404(Notification, pk=pk, user=request.user)
        notification.is_read = True
        notification.save(update_fields=['is_read'])
        return Response(NotificationSerializer(notification).data)


class NotificationMarkAllReadView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response(status=status.HTTP_204_NO_CONTENT)


class SendMessageView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        recipient_id = request.data.get('recipient_id')
        title = request.data.get('title', '').strip()
        message = request.data.get('message', '').strip()

        if not recipient_id or not title or not message:
            return Response(
                {'error': 'Odbiorca, tytuł i treść wiadomości są wymagane.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        recipient = get_object_or_404(User, pk=recipient_id)
        if recipient.pk == request.user.pk:
            return Response(
                {'error': 'Nie można wysłać wiadomości do samego siebie.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        notification = Notification.objects.create(
            user=recipient,
            sender=request.user,
            title=title,
            message=message,
            is_read=False,
        )
        return Response(NotificationSerializer(notification).data, status=status.HTTP_201_CREATED)

MAX_LOGIN_FAILURES = 5
LOGIN_LOCKOUT_SECONDS = 5 * 60


def _login_failures_key(username):
    return f'login-failures:{username.lower()}'


class LoginView(TokenObtainPairView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'

    def post(self, request, *args, **kwargs):
        username = str(request.data.get('username') or '').strip()
        password = str(request.data.get('password') or '')
        failures_key = _login_failures_key(username)

        if cache.get(failures_key, 0) >= MAX_LOGIN_FAILURES:
            return Response(
                {'error': 'Zbyt wiele nieudanych prób. Spróbuj ponownie za kilka minut.', 'code': 'too_many_attempts'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except AuthenticationFailed:
            user = User.objects.filter(username=username).first()
            label = user.full_name if user else username
            if user and not user.is_active and user.check_password(password):
                record_event(
                    request, category='accounts', action='login.inactive_account', obj=user, object_label=label,
                    actor_name=username, description=f'Próba logowania na wyłączone konto {user.full_name}.',
                )
                return Response(
                    {'error': 'To konto jest wyłączone. Skontaktuj się z kierownikiem.', 'code': 'account_inactive'},
                    status=status.HTTP_403_FORBIDDEN,
                )

            failures = cache.get(failures_key, 0) + 1
            cache.set(failures_key, failures, LOGIN_LOCKOUT_SECONDS)
            record_event(
                request, category='accounts', action='login.failed', obj=user, object_label=label,
                actor_name=username,
                description=f'Nieudane logowanie na login „{username}” (próba {failures} z {MAX_LOGIN_FAILURES}).',
            )
            if failures >= MAX_LOGIN_FAILURES:
                record_event(
                    request, category='accounts', action='login.locked', obj=user, object_label=label,
                    actor_name=username,
                    description=(
                        f'Login „{username}” zablokowany na {LOGIN_LOCKOUT_SECONDS // 60} minut '
                        f'po {MAX_LOGIN_FAILURES} nieudanych próbach.'
                    ),
                )
            return Response(
                {'error': 'Nieprawidłowy login lub hasło.', 'code': 'invalid_credentials'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        cache.delete(failures_key)
        user = serializer.user
        record_event(
            request, category='accounts', action='login.succeeded', obj=user, object_label=user.full_name,
            actor=user, description=f'Zalogowano: {user.full_name}.',
        )
        return Response(
            {
                **serializer.validated_data,
                'must_change_password': user.must_change_password,
                'role': user.role,
            },
            status=status.HTTP_200_OK,
        )

class ChangeInitialPasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if not user.must_change_password:
            return Response(
                {'error': 'Hasło może zmienić tylko kierownik.', 'code': 'not_required'},
                status=status.HTTP_403_FORBIDDEN,
            )

        new_password = request.data.get('new_password')
        if not isinstance(new_password, str) or not new_password:
            return Response({'new_password': ['Podaj nowe hasło.']}, status=status.HTTP_400_BAD_REQUEST)
        if user.check_password(new_password):
            return Response(
                {'new_password': ['Nowe hasło musi być inne niż hasło tymczasowe.']},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            password_validation.validate_password(new_password, user)
        except DjangoValidationError as exc:
            return Response({'new_password': list(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            user.set_password(new_password)
            user.must_change_password = False
            user.save(update_fields=['password', 'must_change_password'])
            revoke_refresh_tokens(user)
            record_event(
                request, category='accounts', action='password.initial_set', obj=user, object_label=user.full_name,
                description=f'{user.full_name} ustawił(a) własne hasło po pierwszym logowaniu.',
            )

        refresh = RefreshToken.for_user(user)
        return Response({'access': str(refresh.access_token), 'refresh': str(refresh)})