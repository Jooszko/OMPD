from django.contrib import admin
from .models import StandingOrder, DailyOrder

class TimeStampedAdmin(admin.ModelAdmin):
    readonly_fields = ('created_at', 'updated_at')

@admin.register(StandingOrder)
class StandingOrderAdmin(TimeStampedAdmin):
    list_display = ('client', 'product', 'day_of_week', 'quantity', 'is_active')
    list_filter = ('day_of_week', 'is_active')

@admin.register(DailyOrder)
class DailyOrderAdmin(TimeStampedAdmin):
    list_display = ('order_date', 'client', 'product', 'quantity', 'status')
    list_filter = ('order_date', 'status')