from django.contrib import admin
from .models import IngredientStock, Product, Ingredient, Recipe

class TimeStampedAdmin(admin.ModelAdmin):
    readonly_fields = ('created_at', 'updated_at')

class IngredientStockInline(admin.StackedInline):
    model = IngredientStock
    can_delete = False
    verbose_name_plural = 'Stan Magazynowy'

@admin.register(Ingredient)
class IngredientAdmin(TimeStampedAdmin):
    list_display = ('name', 'unit', 'get_current_stock', 'get_min_stock_level')
    inlines = [IngredientStockInline]

    @admin.display(ordering='stock__current_stock', description='Stan magazynowy')
    def get_current_stock(self, obj):
        try:
            return obj.stock.current_stock
        except IngredientStock.DoesNotExist:
            return "Brak wpisu"

    @admin.display(ordering='stock__min_stock_level', description='Próg minimalny')
    def get_min_stock_level(self, obj):
        try:
            return obj.stock.min_stock_level
        except IngredientStock.DoesNotExist:
            return "Brak wpisu"

class RecipeInline(admin.TabularInline):
    model = Recipe
    extra = 1

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'base_price', 'current_stock')
    list_filter = ('category',)
    inlines = [RecipeInline]