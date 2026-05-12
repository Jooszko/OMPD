from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('manager', 'Manager'),
        ('baker', 'Baker'),
        ('driver', 'Driver'),
    ]

    role = models.CharField(max_length=50, choices=ROLE_CHOICES, default='baker')
    full_name = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = 'users'

    def __str__(self):
        return self.username
