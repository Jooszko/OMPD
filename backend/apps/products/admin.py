from django.contrib import admin
from .models import Product, Ingredient, Recipe

class TimeStampedAdmin(admin.ModelAdmin):
    readonly_fields = ('created_at', 'updated_at')

@admin.register(Ingredient)
class IngredientAdmin(TimeStampedAdmin):
    list_display = ('name', 'unit', 'current_stock', 'min_stock_level')

class RecipeInline(admin.TabularInline):
    model = Recipe
    extra = 1

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'base_price', 'current_stock')
    list_filter = ('category',)
    inlines = [RecipeInline]