from django.contrib import admin

from .models import (
    BatchIngredient,
    BatchOutput,
    BatchStageLog,
    Dough,
    DoughIngredient,
    Mixer,
    PlanLine,
    ProductBakeSpec,
    ProductionBatch,
    ProductionPlan,
    WasteRecord,
)


@admin.register(Mixer)
class MixerAdmin(admin.ModelAdmin):
    list_display = ('name', 'min_capacity_kg', 'max_capacity_kg', 'is_active')
    list_filter = ('is_active',)


class DoughIngredientInline(admin.TabularInline):
    model = DoughIngredient
    extra = 1


class ProductBakeSpecInline(admin.TabularInline):
    model = ProductBakeSpec
    extra = 0


@admin.register(Dough)
class DoughAdmin(admin.ModelAdmin):
    list_display = ('name', 'mixer', 'loss_buffer_pct', 'target_dough_temp_c', 'proofing_time_min')
    inlines = [DoughIngredientInline, ProductBakeSpecInline]


@admin.register(ProductBakeSpec)
class ProductBakeSpecAdmin(admin.ModelAdmin):
    list_display = ('product', 'dough', 'piece_weight_kg', 'bake_temp_c', 'bake_time_min')
    list_filter = ('dough',)


class PlanLineInline(admin.TabularInline):
    model = PlanLine
    extra = 0


@admin.register(ProductionPlan)
class ProductionPlanAdmin(admin.ModelAdmin):
    list_display = ('delivery_date', 'production_date', 'created_by', 'created_at')
    inlines = [PlanLineInline]


class BatchIngredientInline(admin.TabularInline):
    model = BatchIngredient
    extra = 0


class BatchOutputInline(admin.TabularInline):
    model = BatchOutput
    extra = 0


class BatchStageLogInline(admin.TabularInline):
    model = BatchStageLog
    extra = 0


@admin.register(ProductionBatch)
class ProductionBatchAdmin(admin.ModelAdmin):
    list_display = ('plan', 'dough', 'sequence', 'batch_count', 'dough_mass_kg', 'stage', 'stage_worker')
    list_filter = ('stage', 'dough')
    inlines = [BatchIngredientInline, BatchOutputInline, BatchStageLogInline]


@admin.register(WasteRecord)
class WasteRecordAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'batch', 'product', 'stage', 'quantity', 'reason', 'recorded_by')
    list_filter = ('reason', 'stage')
