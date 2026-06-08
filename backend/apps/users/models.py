from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    ROLE_CHOICES = [
        ('admin', 'Kierownik'),
        ('baker', 'Piekarz'),
        ('driver', 'Kierowca'),        
    ]

    user_id = models.AutoField(primary_key=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='baker')
    full_name = models.CharField(max_length=200)

    class Meta:
        db_table = 'users'

    def __str__(self):
        return f"{self.full_name} ({self.get_role_display()})"