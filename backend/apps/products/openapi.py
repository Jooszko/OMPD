from rest_framework import serializers

from .models import Product


class RecipeItemSerializer(serializers.Serializer):
    ingredient_id = serializers.IntegerField()
    ingredient_name = serializers.CharField()
    unit = serializers.CharField()
    amount = serializers.DecimalField(max_digits=10, decimal_places=3, help_text='Ilość surowca na jedną sztukę.')


class RecipeSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    name = serializers.CharField()
    category = serializers.ChoiceField(Product.PRODUCT_CATEGORY_CHOICES)
    items = RecipeItemSerializer(many=True)


class RecipeItemInputSerializer(serializers.Serializer):
    ingredient_id = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=10, decimal_places=3)


class RecipeCreateSerializer(serializers.Serializer):
    name = serializers.CharField()
    category = serializers.ChoiceField(Product.PRODUCT_CATEGORY_CHOICES, required=False, help_text='Domyślnie other.')
    items = RecipeItemInputSerializer(many=True)


class RecipeUpdateSerializer(serializers.Serializer):
    items = RecipeItemInputSerializer(many=True, help_text='Pełny nowy skład – zastępuje dotychczasowy.')