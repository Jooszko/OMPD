from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('full_name', 'username', 'role')
    list_filter = ('role',)
    
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Dodatkowe informacje piekarni', {'fields': ('role', 'full_name')}),
    )