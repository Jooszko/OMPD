from django.urls import path
from .views import (
    CurrentUserView,
    UserListCreateView,
    UserDetailView,
    NotificationListView,
    NotificationMarkReadView,
    NotificationMarkAllReadView,
    SendMessageView,
)

urlpatterns = [
    path('', UserListCreateView.as_view(), name='user-list-create'),
    path('me/', CurrentUserView.as_view(), name='current-user'),
    path('notifications/', NotificationListView.as_view(), name='notification-list'),
    path('notifications/send/', SendMessageView.as_view(), name='notification-send'),
    path('notifications/mark-all-read/', NotificationMarkAllReadView.as_view(), name='notification-mark-all-read'),
    path('notifications/<int:pk>/read/', NotificationMarkReadView.as_view(), name='notification-mark-read'),
    path('<int:pk>/', UserDetailView.as_view(), name='user-detail'),
]