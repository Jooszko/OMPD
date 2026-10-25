"""Ustawienia produkcji: mieszałki, ciasta z recepturą na 1 kg i parametry wyrobów."""
from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from products.models import Ingredient

from .models import Dough, DoughIngredient, Mixer, ProductBakeSpec


class MixerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Mixer
        fields = ['mixer_id', 'name', 'min_capacity_kg', 'max_capacity_kg', 'is_active']

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Podaj nazwę mieszałki.')
        return value

    def validate(self, attrs):
        min_kg = attrs.get('min_capacity_kg', getattr(self.instance, 'min_capacity_kg', Decimal('0')))
        max_kg = attrs.get('max_capacity_kg', getattr(self.instance, 'max_capacity_kg', None))
        if min_kg is not None and min_kg < 0:
            raise serializers.ValidationError({'min_capacity_kg': 'Minimalny wsad nie może być ujemny.'})
        if max_kg is not None and min_kg is not None and min_kg > max_kg:
            raise serializers.ValidationError(
                {'min_capacity_kg': 'Minimalny wsad nie może być większy od maksymalnego.'}
            )
        return attrs


class DoughIngredientSerializer(serializers.Serializer):
    ingredient_id = serializers.PrimaryKeyRelatedField(queryset=Ingredient.objects.all(), source='ingredient')
    name = serializers.CharField(source='ingredient.name', read_only=True)
    unit = serializers.CharField(source='ingredient.unit', read_only=True)
    amount_per_kg = serializers.DecimalField(max_digits=10, decimal_places=4, min_value=Decimal('0.0001'))


class DoughSerializer(serializers.ModelSerializer):
    mixer_id = serializers.PrimaryKeyRelatedField(
        queryset=Mixer.objects.all(), source='mixer', allow_null=True, required=False
    )
    ingredients = DoughIngredientSerializer(source='dough_ingredients', many=True)
    products_count = serializers.SerializerMethodField()

    class Meta:
        model = Dough
        fields = [
            'dough_id', 'name', 'mixer_id', 'loss_buffer_pct', 'mixing_time_min', 'target_dough_temp_c',
            'proofing_time_min', 'mixing_instructions', 'ingredients', 'products_count',
        ]

    def get_products_count(self, dough) -> int:
        return dough.bake_specs.count()

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Podaj nazwę ciasta.')
        return value

    def validate_loss_buffer_pct(self, value):
        if not Decimal('0') <= value < Decimal('100'):
            raise serializers.ValidationError('Bufor strat musi mieścić się w przedziale 0–99,99%.')
        return value

    def validate_ingredients(self, items):
        if not items:
            raise serializers.ValidationError('Receptura musi mieć co najmniej jeden surowiec.')
        ids = [item['ingredient'].pk for item in items]
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError('Każdy surowiec może wystąpić w recepturze tylko raz.')
        return items

    @transaction.atomic
    def create(self, validated_data):
        items = validated_data.pop('dough_ingredients')
        dough = Dough.objects.create(**validated_data)
        self._save_recipe(dough, items)
        return dough

    @transaction.atomic
    def update(self, dough, validated_data):
        items = validated_data.pop('dough_ingredients', None)
        for field, value in validated_data.items():
            setattr(dough, field, value)
        dough.save()
        if items is not None:
            dough.dough_ingredients.all().delete()
            self._save_recipe(dough, items)
        return dough

    @staticmethod
    def _save_recipe(dough, items):
        DoughIngredient.objects.bulk_create([
            DoughIngredient(dough=dough, ingredient=item['ingredient'], amount_per_kg=item['amount_per_kg'])
            for item in items
        ])


class BakeSpecSerializer(serializers.ModelSerializer):
    dough_id = serializers.PrimaryKeyRelatedField(queryset=Dough.objects.all(), source='dough')

    class Meta:
        model = ProductBakeSpec
        fields = ['dough_id', 'piece_weight_kg', 'bake_temp_c', 'bake_time_min']

    def validate_piece_weight_kg(self, value):
        if value <= 0:
            raise serializers.ValidationError('Waga kęsa musi być większa od zera.')
        return value

    def validate_bake_time_min(self, value):
        if value <= 0:
            raise serializers.ValidationError('Czas wypieku musi być większy od zera.')
        return value
