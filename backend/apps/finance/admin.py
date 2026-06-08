from django.contrib import admin
from .models import Supplier, SupplyOrder, SupplyOrderItem, Expense, DailyFinancialReport

class TimeStampedAdmin(admin.ModelAdmin):
    readonly_fields = ('created_at', 'updated_at')

class SupplyOrderItemInline(admin.TabularInline):
    model = SupplyOrderItem
    extra = 1

@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ('name', 'phone', 'email')

@admin.register(SupplyOrder)
class SupplyOrderAdmin(TimeStampedAdmin):
    list_display = ('supply_order_id', 'supplier', 'order_date', 'status')
    list_filter = ('status', 'supplier')
    inlines = [SupplyOrderItemInline]

@admin.register(Expense)
class ExpenseAdmin(TimeStampedAdmin):
    list_display = ('date', 'category', 'amount', 'created_by')
    list_filter = ('category', 'date')

@admin.register(DailyFinancialReport)
class DailyFinancialReportAdmin(TimeStampedAdmin):
    list_display = ('report_date', 'total_revenue', 'net_profit', 'is_finalized')
    readonly_fields = ('created_at', 'updated_at', 'total_revenue', 'total_cogs', 'total_operating_expenses', 'net_profit')