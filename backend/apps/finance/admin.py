from django.contrib import admin
from .models import DailyFinancialReport, Expense, SupplyPurchase


@admin.register(SupplyPurchase)
class SupplyPurchaseAdmin(admin.ModelAdmin):
    list_display = ('ingredient', 'quantity', 'unit_price', 'total_value', 'purchase_date')
    search_fields = ('ingredient__name',)
    date_hierarchy = 'purchase_date'
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-purchase_date',)

    @admin.display(description='Wartość')
    def total_value(self, obj):
        return round(obj.quantity * obj.unit_price, 2)


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ('category', 'amount', 'date', 'description', 'created_by')
    list_filter = ('category',)
    search_fields = ('category', 'description')
    date_hierarchy = 'date'
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-date',)


@admin.register(DailyFinancialReport)
class DailyFinancialReportAdmin(admin.ModelAdmin):
    list_display = ('report_date', 'total_revenue', 'total_cogs', 'net_profit', 'is_finalized', 'generated_by')
    list_filter = ('is_finalized',)
    date_hierarchy = 'report_date'
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-report_date',)
    fieldsets = (
        (None, {'fields': ('report_date', 'is_finalized', 'generated_by')}),
        ('Wyniki finansowe', {
            'fields': ('total_revenue', 'total_cogs', 'total_operating_expenses', 'net_profit')
        }),
        ('Metadane', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )
