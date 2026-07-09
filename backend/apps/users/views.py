from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .models import User
from .serializers import UserSerializer

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