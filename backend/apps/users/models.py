from django.contrib.auth.models import AbstractUser
from django.db import models
from common.models import TimeStampedModel

class User(AbstractUser):
    ROLE_CHOICES = [
        ('admin', 'Kierownik'),
        ('baker', 'Piekarz'),
        ('driver', 'Kierowca'),        
    ]

    user_id = models.AutoField(primary_key=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='baker')
    full_name = models.CharField(max_length=200)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'users'

    def __str__(self):
        return f"{self.full_name} ({self.get_role_display()})"

class Notification(TimeStampedModel):
    user = models.ForeignKey('User', on_delete=models.CASCADE, related_name='notifications')
    sender = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True, related_name='sent_notifications')
    title = models.CharField(max_length=255)
    is_read = models.BooleanField(default=False)
    message = models.TextField()

    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} - {self.title} ({'Przeczytane' if self.is_read else 'Nieprzeczytane'})"