from decimal import Decimal

from rest_framework import serializers
from .models import Ingredient, Product, StockMovement
from .stock import MANUAL_KINDS

STOCK_FIELD = {'max_digits': 10, 'decimal_places': 3, 'min_value': Decimal('0')}


class IngredientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ingredient
        fields = ['ingredient_id', 'name', 'unit']

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Podaj nazwę surowca.')
        return value

    def validate_unit(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Podaj jednostkę.')
        return value

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


class IngredientCreateSerializer(IngredientSerializer):
    current_stock = serializers.DecimalField(**STOCK_FIELD, required=False, write_only=True)

    class Meta(IngredientSerializer.Meta):
        fields = IngredientSerializer.Meta.fields + ['current_stock']


class StockAdjustmentSerializer(serializers.Serializer):
    kind = serializers.ChoiceField([c for c in StockMovement.KIND_CHOICES if c[0] in MANUAL_KINDS])
    quantity = serializers.DecimalField(
        **STOCK_FIELD, help_text='Przyjęcie i rozchód: ilość. Inwentaryzacja: policzony stan.'
    )
    note = serializers.CharField(max_length=200, required=False, allow_blank=True, default='')


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ['product_id', 'name', 'category', 'base_price']
