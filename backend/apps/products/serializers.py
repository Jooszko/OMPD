from rest_framework import serializers
from .models import Ingredient, Product


class IngredientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ingredient
        fields = ['ingredient_id', 'name', 'unit']

    def validate(self, attrs):
        name = attrs.get('name', getattr(self.instance, 'name', ''))
        unit = attrs.get('unit', getattr(self.instance, 'unit', ''))
        duplicates = Ingredient.objects.filter(name__iexact=name, unit__iexact=unit)
        if self.instance:
            duplicates = duplicates.exclude(pk=self.instance.pk)
        if duplicates.exists():
            raise serializers.ValidationError({
                'name': 'Surowiec o tej nazwie i jednostce już istnieje w bazie.'
            })
        return attrs


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ['product_id', 'name', 'category', 'base_price']
