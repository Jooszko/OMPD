from rest_framework import serializers
from .models import Ingredient, Product


class IngredientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ingredient
        fields = ['ingredient_id', 'name', 'unit']


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ['product_id', 'name', 'category', 'base_price']
