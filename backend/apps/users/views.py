from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .models import User, Notification
from .serializers import UserSerializer, NotificationSerializer

class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class UserListCreateView(APIView):
    # Blokujemy dostęp osobom nieautoryzowanym (pracowników dodawać mogą tylko zalogowani użytkownicy)
    permission_classes = [IsAuthenticated]

    def get(self, request):
        users = User.objects.all()
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = UserSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()  # Wywołuje metodę create() z naszego serializera, haszując hasło
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request, pk):
        user = get_object_or_404(User, pk=pk)
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)

        # Hasło jest opcjonalne przy edycji - jeśli puste, nie nadpisujemy istniejącego hasha
        password = data.get('password')
        data.pop('password', None)

        serializer = UserSerializer(user, data=data, partial=True)
        if serializer.is_valid():
            saved_user = serializer.save()
            if password:
                saved_user.set_password(password)
                saved_user.save(update_fields=['password'])
            return Response(UserSerializer(saved_user).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        user = get_object_or_404(User, pk=pk)
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