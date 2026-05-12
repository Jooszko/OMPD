from django.contrib import admin
from .models import Ingredient, Product, Recipe


class RecipeInline(admin.TabularInline):
    model = Recipe
    extra = 0
    fields = ('ingredient', 'amount')


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'base_price')
    list_filter = ('category',)
    search_fields = ('name', 'category')
    ordering = ('category', 'name')
    inlines = [RecipeInline]


@admin.register(Ingredient)
class IngredientAdmin(admin.ModelAdmin):
    list_display = ('name', 'unit', 'current_stock', 'min_stock_level', 'stock_status')
    search_fields = ('name',)
    ordering = ('name',)

    @admin.display(description='Stan magazynu', boolean=True)
    def stock_status(self, obj):
        return obj.current_stock >= obj.min_stock_level


@admin.register(Recipe)
class RecipeAdmin(admin.ModelAdmin):
    list_display = ('product', 'ingredient', 'amount')
    search_fields = ('product__name', 'ingredient__name')
    list_filter = ('product',)
