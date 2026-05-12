from django.contrib import admin
from .models import Client, Route


class ClientInline(admin.TabularInline):
    model = Client
    extra = 0
    fields = ('name', 'address', 'is_active')
    show_change_link = True


@admin.register(Route)
class RouteAdmin(admin.ModelAdmin):
    list_display = ('route_name', 'driver', 'client_count')
    search_fields = ('route_name', 'driver__full_name', 'driver__username')
    inlines = [ClientInline]

    @admin.display(description='Liczba klientów')
    def client_count(self, obj):
        return obj.clients.count()


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ('name', 'route', 'is_active', 'address')
    list_filter = ('is_active', 'route')
    search_fields = ('name', 'address')
    ordering = ('name',)
    list_editable = ('is_active',)
