from django.contrib import admin
from .models import DailyOrder, StandingOrder


@admin.register(DailyOrder)
class DailyOrderAdmin(admin.ModelAdmin):
    list_display = ('client', 'product', 'order_date', 'quantity', 'price_at_sale', 'status')
    list_filter = ('status', 'order_date', 'product__category')
    search_fields = ('client__name', 'product__name')
    date_hierarchy = 'order_date'
    ordering = ('-order_date', 'client__name')
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        (None, {
            'fields': ('client', 'product', 'order_date', 'quantity', 'price_at_sale', 'status')
        }),
        ('Metadane', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )


@admin.register(StandingOrder)
class StandingOrderAdmin(admin.ModelAdmin):
    list_display = ('client', 'product', 'get_day_display', 'quantity', 'is_active')
    list_filter = ('is_active', 'day_of_week', 'product__category')
    search_fields = ('client__name', 'product__name')
    list_editable = ('is_active',)
    readonly_fields = ('created_at', 'updated_at')

    @admin.display(description='Dzień tygodnia')
    def get_day_display(self, obj):
        return obj.get_day_of_week_display()
