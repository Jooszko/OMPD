from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ('Bakery', {'fields': ('role', 'full_name')}),
    )
    list_display = ('username', 'full_name', 'role', 'is_active')
    list_filter = ('role', 'is_active')
