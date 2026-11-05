from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse
from rest_framework import serializers

from common.openapi import error_response
from products.models import Product

from .models import ProductionBatch, WasteRecord
from .serializers import BakeSpecSerializer, DoughSerializer, MixerSerializer

DELIVERY_DATE_PARAM = OpenApiParameter(
    'delivery_date', OpenApiTypes.DATE,
    description='Dzień dostawy, na który piecze się plan (domyślnie ten, na który piecze bieżąca zmiana).',
)


class PersonSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()
    full_name = serializers.CharField()


class FormErrorSerializer(serializers.Serializer):
    error = serializers.CharField(help_text='Pierwszy komunikat – do pokazania przy formularzu.')
    fields = serializers.DictField(help_text='Wszystkie błędy: pole → lista komunikatów.')


FORM_ERROR = OpenApiResponse(FormErrorSerializer, description='Błędy walidacji formularza.')
FORBIDDEN = error_response('Brak uprawnień (produkcja: kierownik i piekarz, zmiany: tylko kierownik).')
NOT_FOUND = OpenApiResponse(description='Nie znaleziono.')


class PlanMixerSerializer(serializers.Serializer):
    mixer_id = serializers.IntegerField()
    name = serializers.CharField()
    min_capacity_kg = serializers.FloatField()
    max_capacity_kg = serializers.FloatField()


class PlanProductRowSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    product_name = serializers.CharField()
    ordered_qty = serializers.IntegerField()
    piece_weight_kg = serializers.FloatField()
    raw_mass_kg = serializers.FloatField()
    bake_temp_c = serializers.IntegerField()
    bake_time_min = serializers.IntegerField()


class PlanOutputSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    product_name = serializers.CharField()
    pieces = serializers.IntegerField()


class WeighingSerializer(serializers.Serializer):
    ingredient_id = serializers.IntegerField()
    name = serializers.CharField()
    unit = serializers.CharField()
    amount = serializers.FloatField()


class PlanBatchSerializer(serializers.Serializer):
    sequence = serializers.IntegerField()
    dough_mass_kg = serializers.FloatField()
    outputs = PlanOutputSerializer(many=True)
    ingredients = WeighingSerializer(many=True, help_text='Lista odważeń surowców na tę dzieżę.')


class PlanDoughSerializer(serializers.Serializer):
    dough_id = serializers.IntegerField()
    name = serializers.CharField()
    loss_buffer_pct = serializers.FloatField()
    raw_mass_kg = serializers.FloatField()
    total_mass_kg = serializers.FloatField(help_text='Masa ciasta z zapasem na straty.')
    mixer = PlanMixerSerializer(allow_null=True)
    products = PlanProductRowSerializer(many=True)
    batches = PlanBatchSerializer(many=True)
    warnings = serializers.ListField(child=serializers.CharField())
    notes = serializers.ListField(child=serializers.CharField())


class UnassignedProductSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    product_name = serializers.CharField()
    ordered_qty = serializers.IntegerField()


class IngredientBalanceSerializer(WeighingSerializer):
    current_stock = serializers.FloatField()
    min_stock_level = serializers.FloatField(help_text='Próg minimalny surowca (zużycie z ostatnich 7 dni).')
    shortage = serializers.FloatField(help_text='Ile surowca brakuje w magazynie.')


class PlanPreviewSerializer(serializers.Serializer):
    delivery_date = serializers.DateField()
    production_date = serializers.DateField()
    doughs = PlanDoughSerializer(many=True)
    unassigned_products = UnassignedProductSerializer(many=True, help_text='Wyroby bez parametrów produkcji.')
    ingredient_totals = IngredientBalanceSerializer(many=True)


class PlanSummarySerializer(serializers.Serializer):
    plan_id = serializers.IntegerField()
    created_at = serializers.DateTimeField()
    created_by = PersonSerializer(allow_null=True)
    locked = serializers.BooleanField(help_text='Produkcja już ruszyła – planu nie można wygenerować ponownie.')


class OrderChangeSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    product_name = serializers.CharField()
    planned_qty = serializers.IntegerField()
    current_qty = serializers.IntegerField()
    difference = serializers.IntegerField()


class ProductionPlanSerializer(serializers.Serializer):
    preview = PlanPreviewSerializer(help_text='Przed zatwierdzeniem – wyliczenie na żywo, po – zapisane dzieże.')
    plan = PlanSummarySerializer(allow_null=True)
    order_changes = OrderChangeSerializer(many=True, help_text='Zmiany zamówień od zatwierdzenia planu.')


class DeliveryDateInputSerializer(serializers.Serializer):
    delivery_date = serializers.DateField(required=False)


class MixingSerializer(serializers.Serializer):
    instructions = serializers.CharField()
    mixing_time_min = serializers.IntegerField()
    target_dough_temp_c = serializers.FloatField()


class BatchOutputSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    product_name = serializers.CharField()
    planned_pieces = serializers.IntegerField()
    waste_pieces = serializers.IntegerField()
    good_pieces = serializers.IntegerField()
    piece_weight_kg = serializers.FloatField()
    bake_temp_c = serializers.IntegerField()
    bake_time_min = serializers.IntegerField()


class StageLogSerializer(serializers.Serializer):
    stage = serializers.ChoiceField(ProductionBatch.STAGE_CHOICES)
    stage_label = serializers.CharField()
    started_by = PersonSerializer(allow_null=True)
    started_at = serializers.DateTimeField()
    finished_by = PersonSerializer(allow_null=True)
    finished_at = serializers.DateTimeField(allow_null=True)


class WasteEntrySerializer(serializers.Serializer):
    waste_id = serializers.IntegerField()
    product_id = serializers.IntegerField()
    product_name = serializers.CharField()
    stage = serializers.ChoiceField(ProductionBatch.STAGE_CHOICES)
    stage_label = serializers.CharField()
    quantity = serializers.IntegerField()
    reason = serializers.ChoiceField(WasteRecord.REASON_CHOICES)
    reason_label = serializers.CharField()
    recorded_by = PersonSerializer(allow_null=True)
    created_at = serializers.DateTimeField()


class BatchSerializer(serializers.Serializer):
    batch_id = serializers.IntegerField()
    dough_id = serializers.IntegerField()
    dough_name = serializers.CharField()
    sequence = serializers.IntegerField()
    batch_count = serializers.IntegerField()
    dough_mass_kg = serializers.FloatField()
    mixer_name = serializers.CharField(allow_null=True)
    stage = serializers.ChoiceField(ProductionBatch.STAGE_CHOICES)
    stage_label = serializers.CharField()
    next_stage = serializers.CharField(allow_null=True)
    next_stage_label = serializers.CharField(allow_null=True)
    stage_started_at = serializers.DateTimeField(allow_null=True)
    stage_worker = PersonSerializer(allow_null=True, help_text='Kto pracuje teraz nad dzieżą.')
    completed_at = serializers.DateTimeField(allow_null=True)
    mixing = MixingSerializer()
    proofing_time_min = serializers.IntegerField()
    ingredients = WeighingSerializer(many=True)
    outputs = BatchOutputSerializer(many=True)
    history = StageLogSerializer(many=True)
    waste = WasteEntrySerializer(many=True)


class CoverageRowSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    product_name = serializers.CharField()
    ordered_qty = serializers.IntegerField()
    planned_qty = serializers.IntegerField()
    waste_qty = serializers.IntegerField()
    expected_qty = serializers.IntegerField()
    finished_qty = serializers.IntegerField()
    shortfall = serializers.IntegerField(help_text='Ilu sztuk zabraknie do zamówień.')


class BoardViewerSerializer(PersonSerializer):
    role = serializers.CharField()


class OptionSerializer(serializers.Serializer):
    value = serializers.CharField()
    label = serializers.CharField()


class ProductionBoardSerializer(serializers.Serializer):
    delivery_date = serializers.DateField()
    production_date = serializers.DateField()
    plan = PlanSummarySerializer(allow_null=True)
    batches = BatchSerializer(many=True)
    coverage = CoverageRowSerializer(many=True)
    viewer = BoardViewerSerializer()
    waste_reasons = OptionSerializer(many=True)


class StageInputSerializer(serializers.Serializer):
    stage = serializers.ChoiceField(
        ProductionBatch.STAGE_CHOICES, required=False,
        help_text='Etap, który widzi piekarz – gdy dzieża jest już dalej, serwer zwraca 409.',
    )


class WasteInputSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)
    reason = serializers.ChoiceField(WasteRecord.REASON_CHOICES)


class BatchActionResultSerializer(serializers.Serializer):
    batch = BatchSerializer()
    coverage = CoverageRowSerializer(many=True)


class WasteResultSerializer(BatchActionResultSerializer):
    waste_id = serializers.IntegerField()
    shortfall = serializers.IntegerField()


class BakeSpecWithDoughSerializer(BakeSpecSerializer):
    dough_name = serializers.CharField()

    class Meta(BakeSpecSerializer.Meta):
        fields = BakeSpecSerializer.Meta.fields + ['dough_name']


class BakeSpecRowSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    product_name = serializers.CharField()
    category = serializers.ChoiceField(Product.PRODUCT_CATEGORY_CHOICES)
    spec = BakeSpecWithDoughSerializer(allow_null=True, help_text='Brak = wyrób nie jest planowany.')


class SettingsIngredientSerializer(serializers.Serializer):
    ingredient_id = serializers.IntegerField()
    name = serializers.CharField()
    unit = serializers.CharField()


class ProductionSettingsSerializer(serializers.Serializer):
    mixers = MixerSerializer(many=True)
    doughs = DoughSerializer(many=True)
    products = BakeSpecRowSerializer(many=True)
    ingredients = SettingsIngredientSerializer(many=True)
    loss_buffer_pct = serializers.DecimalField(
        max_digits=5, decimal_places=2, help_text='Wspólny bufor strat ciast i finansów (stała systemowa).'
    )

class DoughSuggestionAdditionSerializer(serializers.Serializer):
    ingredient_id = serializers.IntegerField()
    name = serializers.CharField()
    unit = serializers.CharField()
    amount = serializers.DecimalField(max_digits=10, decimal_places=3, help_text='Na sztukę, w jednostce surowca.')


class DoughSuggestionSerializer(serializers.Serializer):
    dough_id = serializers.IntegerField()
    dough_name = serializers.CharField()
    score = serializers.DecimalField(max_digits=4, decimal_places=3, help_text='Zgodność składu 0–1.')
    piece_weight_kg = serializers.DecimalField(max_digits=7, decimal_places=3, help_text='Proponowana waga kęsa.')
    additions = DoughSuggestionAdditionSerializer(many=True, help_text='Surowce ponad część z ciasta.')
    missing = serializers.ListField(child=serializers.CharField(), help_text='Surowce ciasta, których brak w recepturze.')


class DoughSuggestionsSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    has_recipe = serializers.BooleanField()
    good_match = serializers.DecimalField(max_digits=3, decimal_places=2, help_text='Próg dobrego dopasowania.')
    suggestions = DoughSuggestionSerializer(many=True)


class PlanCalendarDaySerializer(serializers.Serializer):
    delivery_date = serializers.DateField()
    production_date = serializers.DateField()
    status = serializers.ChoiceField(
        ['none', 'saved', 'in_progress', 'done'],
        help_text='none – brak planu, saved – zapisany, in_progress – produkcja ruszyła, done – wszystkie dzieże gotowe.',
    )
    batches = serializers.IntegerField()
    done_batches = serializers.IntegerField()
    pieces = serializers.IntegerField(help_text='Zamówione sztuki na ten dzień dostawy.')
