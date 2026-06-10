from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import Notification, User

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('full_name', 'username', 'role')
    list_filter = ('role',)

    fieldsets = BaseUserAdmin.fieldsets + (
        ('Dodatkowe informacje piekarni', {'fields': ('role', 'full_name')}),
    )

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('user', 'title', 'is_read', 'created_at')
    list_filter = ('is_read', 'user')
    search_fields = ('title', 'message', 'user__username')