from rest_framework import serializers

from .models import Product, StockMovement


class RecipeItemSerializer(serializers.Serializer):
    ingredient_id = serializers.IntegerField()
    ingredient_name = serializers.CharField()
    unit = serializers.CharField()
    amount = serializers.DecimalField(max_digits=10, decimal_places=3, help_text='Ilość surowca na jedną sztukę.')


class RecipeDoughSerializer(serializers.Serializer):
    dough_id = serializers.IntegerField()
    dough_name = serializers.CharField()
    piece_weight_kg = serializers.DecimalField(max_digits=7, decimal_places=3)
    dough_items = RecipeItemSerializer(many=True, help_text='Część z ciasta: skład na 1 kg x waga kęsa (tylko do odczytu).')
    additions = RecipeItemSerializer(many=True, help_text='Dodatki spoza ciasta – jedyna edytowalna część.')


class RecipeSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    name = serializers.CharField()
    category = serializers.ChoiceField(Product.PRODUCT_CATEGORY_CHOICES)
    items = RecipeItemSerializer(many=True, help_text='Pełna receptura na sztukę.')
    dough = RecipeDoughSerializer(allow_null=True, help_text='Podział receptury, gdy wyrób jest przypisany do ciasta.')


class RecipeItemInputSerializer(serializers.Serializer):
    ingredient_id = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=10, decimal_places=3)


class RecipeCreateSerializer(serializers.Serializer):
    name = serializers.CharField()
    category = serializers.ChoiceField(Product.PRODUCT_CATEGORY_CHOICES, required=False, help_text='Domyślnie other.')
    items = RecipeItemInputSerializer(many=True)


class RecipeUpdateSerializer(serializers.Serializer):
    items = RecipeItemInputSerializer(many=True, help_text=(
        'Wyrób bez ciasta: pełny nowy skład. Wyrób z ciastem: tylko dodatki (może być pusta lista) – '
        'część z ciasta wylicza się sama.'
    ))

class DeliveryOfferSerializer(serializers.Serializer):
    supplier_id = serializers.IntegerField()
    name = serializers.CharField()
    price = serializers.DecimalField(
        max_digits=10, decimal_places=2, allow_null=True, help_text='Cena u dostawcy za jednostkę.'
    )


class WarehouseRowSerializer(serializers.Serializer):
    ingredient_id = serializers.IntegerField()
    name = serializers.CharField()
    unit = serializers.CharField()
    current_stock = serializers.DecimalField(max_digits=10, decimal_places=3)
    min_stock_level = serializers.DecimalField(
        max_digits=10, decimal_places=3, help_text='Suma zużycia w produkcji z ostatnich 7 dni.'
    )
    daily_usage = serializers.DecimalField(
        max_digits=12, decimal_places=3, help_text='Średnie dzienne zużycie w produkcji z ostatnich 7 dni.'
    )
    days_left = serializers.FloatField(allow_null=True, help_text='Na ile dni wystarczy stan przy średnim zużyciu.')
    last_delivery_at = serializers.DateTimeField(allow_null=True)
    updated_at = serializers.DateTimeField(allow_null=True)
    current_price = serializers.DecimalField(
        max_digits=10, decimal_places=2, allow_null=True,
        help_text='Cena magazynowa za jednostkę: średnia ważona ilością ze stanu i przyjętych dostaw.',
    )
    suppliers = DeliveryOfferSerializer(many=True, help_text='Aktywni dostawcy, u których surowiec jest przypisany.')


class WarehouseSerializer(serializers.Serializer):
    items = WarehouseRowSerializer(many=True)


class StockDaySerializer(serializers.Serializer):
    date = serializers.DateField()
    balance = serializers.DecimalField(max_digits=12, decimal_places=3, help_text='Stan na koniec dnia.')
    received = serializers.DecimalField(max_digits=12, decimal_places=3)
    used = serializers.DecimalField(max_digits=12, decimal_places=3)
    corrected = serializers.DecimalField(max_digits=12, decimal_places=3, help_text='Inwentaryzacje i stan początkowy.')


class StockMovementSerializer(serializers.Serializer):
    movement_id = serializers.IntegerField()
    kind = serializers.ChoiceField(StockMovement.KIND_CHOICES)
    quantity = serializers.DecimalField(max_digits=12, decimal_places=3, help_text='Zmiana stanu ze znakiem.')
    balance_after = serializers.DecimalField(max_digits=12, decimal_places=3)
    note = serializers.CharField()
    created_at = serializers.DateTimeField()
    created_by_name = serializers.CharField()


class StockHistorySerializer(serializers.Serializer):
    days = serializers.IntegerField()
    series = StockDaySerializer(many=True)
    movements = StockMovementSerializer(many=True)
