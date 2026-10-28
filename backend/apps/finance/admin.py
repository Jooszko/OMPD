from django.contrib import admin
from .models import Supplier, Expense, DailyFinancialReport

class TimeStampedAdmin(admin.ModelAdmin):
    readonly_fields = ('created_at', 'updated_at')

@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ('name', 'phone', 'email')

@admin.register(Expense)
class ExpenseAdmin(TimeStampedAdmin):
    list_display = ('date', 'category', 'amount', 'created_by')
    list_filter = ('category', 'date')

@admin.register(DailyFinancialReport)
class DailyFinancialReportAdmin(TimeStampedAdmin):
    list_display = ('report_date', 'total_revenue', 'net_profit', 'is_finalized')
    readonly_fields = ('created_at', 'updated_at', 'total_revenue', 'total_cogs', 'total_operating_expenses', 'net_profit')