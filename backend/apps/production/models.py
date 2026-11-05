from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models

from common.losses import LOSS_BUFFER_PCT
from common.models import TimeStampedModel


class Mixer(TimeStampedModel):
    """Mieszałka (dzieża) — ogranicza masę ciasta, jaką da się wymieszać w jednej partii."""

    mixer_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    min_capacity_kg = models.DecimalField(max_digits=8, decimal_places=3, default=Decimal('0.000'))
    max_capacity_kg = models.DecimalField(
        max_digits=8, decimal_places=3, validators=[MinValueValidator(Decimal('0.001'))]
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(max_capacity_kg__gt=0), name='mixer_max_capacity_positive'
            ),
            models.CheckConstraint(
                condition=models.Q(min_capacity_kg__lte=models.F('max_capacity_kg')),
                name='mixer_min_not_above_max',
            ),
        ]

    def __str__(self):
        return f'{self.name} ({self.min_capacity_kg}–{self.max_capacity_kg} kg)'


class Dough(TimeStampedModel):
    """Wspólna baza ciasta — jedna receptura, z której powstaje kilka wyrobów gotowych."""

    dough_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100, unique=True)
    mixer = models.ForeignKey(
        Mixer, on_delete=models.SET_NULL, null=True, blank=True, related_name='doughs',
        help_text='Domyślna mieszałka. Gdy brak — największa aktywna mieszałka.',
    )
    loss_buffer_pct = models.DecimalField(
        max_digits=5, decimal_places=2, default=LOSS_BUFFER_PCT,
        help_text='Bufor na straty technologiczne (% masy ciasta) — wspólny z finansami (common.losses).',
    )
    mixing_instructions = models.TextField(blank=True, default='')
    mixing_time_min = models.PositiveIntegerField(default=10)
    target_dough_temp_c = models.DecimalField(max_digits=4, decimal_places=1, default=Decimal('26.0'))
    proofing_time_min = models.PositiveIntegerField(default=45)
    ingredients = models.ManyToManyField('products.Ingredient', through='DoughIngredient', related_name='doughs')

    def __str__(self):
        return self.name


class DoughIngredient(models.Model):
    """Ilość surowca (w jednostce surowca) na 1 kg gotowego ciasta."""

    dough = models.ForeignKey(Dough, on_delete=models.CASCADE, related_name='dough_ingredients')
    ingredient = models.ForeignKey('products.Ingredient', on_delete=models.PROTECT, related_name='dough_usages')
    amount_per_kg = models.DecimalField(max_digits=10, decimal_places=4)

    class Meta:
        unique_together = ('dough', 'ingredient')

    def __str__(self):
        return f'{self.dough.name}: {self.amount_per_kg} {self.ingredient.unit}/kg {self.ingredient.name}'


class ProductBakeSpec(TimeStampedModel):
    """Parametry produkcyjne wyrobu: z jakiego ciasta, waga kęsa i parametry wypieku."""

    product = models.OneToOneField(
        'products.Product', on_delete=models.CASCADE, primary_key=True, related_name='bake_spec'
    )
    dough = models.ForeignKey(Dough, on_delete=models.PROTECT, related_name='bake_specs')
    piece_weight_kg = models.DecimalField(
        max_digits=7, decimal_places=3, validators=[MinValueValidator(Decimal('0.001'))],
        help_text='Waga surowego kęsa.',
    )
    bake_temp_c = models.PositiveIntegerField(default=230)
    bake_time_min = models.PositiveIntegerField(default=30)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=models.Q(piece_weight_kg__gt=0), name='bake_spec_piece_weight_positive'),
        ]

    def __str__(self):
        return f'{self.product.name} ← {self.dough.name} ({self.piece_weight_kg} kg)'


class ProductionPlan(TimeStampedModel):
    """Plan produkcji dla daty dostawy. Produkcja odbywa się z wyprzedzeniem (production_date)."""

    plan_id = models.AutoField(primary_key=True)
    delivery_date = models.DateField(unique=True)
    production_date = models.DateField()
    created_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='production_plans'
    )

    class Meta:
        ordering = ['-delivery_date']

    def __str__(self):
        return f'Plan {self.production_date} → dostawa {self.delivery_date}'


class PlanLine(models.Model):
    """Zapotrzebowanie na wyrób w planie — snapshot zamówień z chwili generowania."""

    plan = models.ForeignKey(ProductionPlan, on_delete=models.CASCADE, related_name='lines')
    product = models.ForeignKey('products.Product', on_delete=models.PROTECT, related_name='plan_lines')
    ordered_qty = models.PositiveIntegerField()

    class Meta:
        unique_together = ('plan', 'product')


class ProductionBatch(TimeStampedModel):
    STAGE_MIXING = 'mixing'
    STAGE_DIVIDING = 'dividing'
    STAGE_PROOFING = 'proofing'
    STAGE_BAKING = 'baking'
    STAGE_DONE = 'done'
    STAGE_CHOICES = [
        (STAGE_MIXING, 'Mieszanie'),
        (STAGE_DIVIDING, 'Dzielenie / formowanie'),
        (STAGE_PROOFING, 'Garowanie'),
        (STAGE_BAKING, 'Wypiek'),
        (STAGE_DONE, 'Zakończona'),
    ]
    STAGE_ORDER = [STAGE_MIXING, STAGE_DIVIDING, STAGE_PROOFING, STAGE_BAKING, STAGE_DONE]

    batch_id = models.AutoField(primary_key=True)
    plan = models.ForeignKey(ProductionPlan, on_delete=models.CASCADE, related_name='batches')
    dough = models.ForeignKey(Dough, on_delete=models.PROTECT, related_name='batches')
    mixer = models.ForeignKey(Mixer, on_delete=models.SET_NULL, null=True, blank=True, related_name='batches')
    sequence = models.PositiveIntegerField(help_text='Numer dzieży w ramach ciasta (1..n).')
    batch_count = models.PositiveIntegerField(help_text='Liczba dzieży tego ciasta w planie.')
    dough_mass_kg = models.DecimalField(max_digits=9, decimal_places=3)
    stage = models.CharField(max_length=20, choices=STAGE_CHOICES, default=STAGE_MIXING)
    stage_started_at = models.DateTimeField(null=True, blank=True)
    stage_worker = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='active_batches'
    )
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['plan', 'dough__name', 'sequence']
        constraints = [
            models.UniqueConstraint(fields=['plan', 'dough', 'sequence'], name='unique_batch_sequence_per_dough'),
        ]

    @property
    def is_stage_in_progress(self):
        return self.stage_started_at is not None

    @property
    def next_stage(self):
        index = self.STAGE_ORDER.index(self.stage)
        return self.STAGE_ORDER[index + 1] if index + 1 < len(self.STAGE_ORDER) else None

    def __str__(self):
        return f'{self.dough.name} #{self.sequence}/{self.batch_count} ({self.get_stage_display()})'


class BatchIngredient(models.Model):
    """Lista do odważenia — snapshot receptury przeliczonej na masę dzieży."""

    batch = models.ForeignKey(ProductionBatch, on_delete=models.CASCADE, related_name='ingredients')
    ingredient = models.ForeignKey('products.Ingredient', on_delete=models.PROTECT, related_name='batch_usages')
    amount = models.DecimalField(max_digits=10, decimal_places=3)

    class Meta:
        unique_together = ('batch', 'ingredient')


class BatchOutput(models.Model):
    """Ile kęsów danego wyrobu ma powstać z dzieży."""

    batch = models.ForeignKey(ProductionBatch, on_delete=models.CASCADE, related_name='outputs')
    product = models.ForeignKey('products.Product', on_delete=models.PROTECT, related_name='batch_outputs')
    planned_pieces = models.PositiveIntegerField()
    piece_weight_kg = models.DecimalField(max_digits=7, decimal_places=3)
    bake_temp_c = models.PositiveIntegerField()
    bake_time_min = models.PositiveIntegerField()

    class Meta:
        unique_together = ('batch', 'product')


class BatchStageLog(models.Model):
    """Ślad produkcyjny: kto i kiedy wykonał dany etap partii."""

    batch = models.ForeignKey(ProductionBatch, on_delete=models.CASCADE, related_name='stage_logs')
    stage = models.CharField(max_length=20, choices=ProductionBatch.STAGE_CHOICES)
    started_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, related_name='started_stage_logs'
    )
    started_at = models.DateTimeField()
    finished_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='finished_stage_logs'
    )
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['started_at']


class WasteRecord(TimeStampedModel):
    REASON_CHOICES = [
        ('damaged', 'Uszkodzone kęsy'),
        ('misshaped', 'Źle uformowane'),
        ('overproofed', 'Przegarowane'),
        ('burnt', 'Przypalone'),
        ('underbaked', 'Niedopieczone'),
        ('dropped', 'Upadło / zabrudzone'),
        ('other', 'Inny powód'),
    ]

    waste_id = models.AutoField(primary_key=True)
    batch = models.ForeignKey(ProductionBatch, on_delete=models.CASCADE, related_name='waste_records')
    product = models.ForeignKey('products.Product', on_delete=models.PROTECT, related_name='waste_records')
    stage = models.CharField(max_length=20, choices=ProductionBatch.STAGE_CHOICES)
    quantity = models.PositiveIntegerField()
    reason = models.CharField(max_length=20, choices=REASON_CHOICES)
    recorded_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='recorded_waste'
    )

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.CheckConstraint(condition=models.Q(quantity__gt=0), name='waste_quantity_positive'),
        ]

    def __str__(self):
        return f'{self.product.name} x{self.quantity} ({self.get_reason_display()})'
