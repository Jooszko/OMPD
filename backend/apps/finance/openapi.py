from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter
from rest_framework import serializers

from .models import Expense
from .serializers import SupplierSerializer
from .statement import PERIOD_KINDS


def money(**kwargs):
    return serializers.DecimalField(max_digits=12, decimal_places=2, **kwargs)


def range_params(default_days):
    return [
        OpenApiParameter('start', OpenApiTypes.DATE, description=f'Początek okresu (domyślnie {default_days} dni przed końcem).'),
        OpenApiParameter('end', OpenApiTypes.DATE, description='Koniec okresu (domyślnie dziś).'),
    ]


STATEMENT_PARAMS = [
    OpenApiParameter('period', str, enum=list(PERIOD_KINDS), description='Rodzaj okresu (domyślnie month).'),
    OpenApiParameter('date', OpenApiTypes.DATE, description='Dowolny dzień z okresu (domyślnie dziś).'),
]


class ExpenseSerializer(serializers.Serializer):
    expense_id = serializers.IntegerField()
    category = serializers.ChoiceField(Expense.CATEGORY_CHOICES)
    category_label = serializers.CharField()
    amount = money()
    description = serializers.CharField()
    date = serializers.DateField()
    created_by = serializers.CharField(allow_null=True)
    recurring_id = serializers.IntegerField(allow_null=True, help_text='Wydatek cykliczny, z którego powstał ten wpis.')


class ExpenseInputSerializer(serializers.Serializer):
    category = serializers.ChoiceField(Expense.CATEGORY_CHOICES)
    amount = money()
    date = serializers.DateField(help_text='Nie może być w przyszłości.')
    description = serializers.CharField(required=False, allow_blank=True)
    repeat_monthly = serializers.BooleanField(required=False, help_text='Utwórz też wydatek cykliczny co miesiąc.')
    day_of_month = serializers.IntegerField(required=False, min_value=1, max_value=31, help_text='Dzień powtarzania (domyślnie dzień z date).')


class ExpenseUpdateSerializer(serializers.Serializer):
    category = serializers.ChoiceField(Expense.CATEGORY_CHOICES, required=False)
    amount = money(required=False)
    date = serializers.DateField(required=False)
    description = serializers.CharField(required=False, allow_blank=True)


class RecurringExpenseSerializer(serializers.Serializer):
    recurring_id = serializers.IntegerField()
    category = serializers.ChoiceField(Expense.CATEGORY_CHOICES)
    category_label = serializers.CharField()
    amount = money()
    description = serializers.CharField()
    day_of_month = serializers.IntegerField()
    is_active = serializers.BooleanField()
    next_date = serializers.DateField(allow_null=True)
    previous_date = serializers.DateField(allow_null=True)
    days_until_next = serializers.IntegerField(allow_null=True)


class RecurringListSerializer(serializers.Serializer):
    monthly_total = money(help_text='Suma aktywnych wydatków cyklicznych.')
    items = RecurringExpenseSerializer(many=True)


class RecurringUpdateSerializer(ExpenseUpdateSerializer):
    date = None
    day_of_month = serializers.IntegerField(required=False, min_value=1, max_value=31)
    is_active = serializers.BooleanField(required=False)


class PeriodSerializer(serializers.Serializer):
    start = serializers.DateField()
    end = serializers.DateField()


class OverviewPeriodSerializer(PeriodSerializer):
    previous_start = serializers.DateField()
    previous_end = serializers.DateField()


class OverviewTotalsSerializer(serializers.Serializer):
    sales = money()
    returns = money()
    revenue = money()
    cogs = money()
    operating_expenses = money()
    net_profit = money()


class CategoryAmountSerializer(serializers.Serializer):
    category = serializers.CharField()
    label = serializers.CharField()
    amount = money()


class OverviewDaySerializer(serializers.Serializer):
    date = serializers.DateField()
    revenue = money()
    cogs = money()
    operating_expenses = money()
    net_profit = money()
    cumulative_profit = money()
    expenses = CategoryAmountSerializer(many=True)


class CostRowSerializer(serializers.Serializer):
    key = serializers.CharField()
    label = serializers.CharField()
    group = serializers.ChoiceField(['cogs', 'operating'])
    amount = money()
    previous = money()


class TopClientSerializer(serializers.Serializer):
    client_id = serializers.IntegerField()
    name = serializers.CharField()
    revenue = money()
    previous_revenue = money(allow_null=True)
    deliveries = serializers.IntegerField()


class OtherClientsSerializer(serializers.Serializer):
    clients = serializers.IntegerField()
    revenue = money()


class RecentExpenseSerializer(serializers.Serializer):
    expense_id = serializers.IntegerField()
    date = serializers.DateField()
    category = serializers.ChoiceField(Expense.CATEGORY_CHOICES)
    category_label = serializers.CharField()
    description = serializers.CharField()
    amount = money()


class OverviewSerializer(serializers.Serializer):
    period = OverviewPeriodSerializer()
    totals = OverviewTotalsSerializer()
    previous_totals = OverviewTotalsSerializer(help_text='Ten sam okres tuż przed wybranym.')
    daily = OverviewDaySerializer(many=True)
    cost_structure = CostRowSerializer(many=True)
    top_clients = TopClientSerializer(many=True)
    other_clients = OtherClientsSerializer()
    recent_expenses = RecentExpenseSerializer(many=True)


class ProductProfitSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    name = serializers.CharField()
    category_label = serializers.CharField()
    price = money()
    unit_cost = money(allow_null=True, help_text='Koszt surowców na sztukę z receptury i cen dostawców.')
    unit_margin = money(allow_null=True)
    margin_pct = serializers.FloatField(allow_null=True)
    sold = serializers.IntegerField()
    revenue = money()
    period_margin = money(allow_null=True)
    has_recipe = serializers.BooleanField()
    missing_prices = serializers.ListField(child=serializers.CharField(), help_text='Surowce bez ceny magazynowej.')


class MissingPriceSerializer(serializers.Serializer):
    ingredient_id = serializers.IntegerField()
    name = serializers.CharField()
    unit = serializers.CharField()
    products = serializers.ListField(child=serializers.CharField())


class ProfitabilitySerializer(serializers.Serializer):
    period = PeriodSerializer()
    average_margin_pct = serializers.FloatField(allow_null=True)
    products = ProductProfitSerializer(many=True)
    missing_prices = MissingPriceSerializer(many=True)


class StatementPeriodSerializer(PeriodSerializer):
    kind = serializers.ChoiceField(PERIOD_KINDS)
    label = serializers.CharField()
    previous_label = serializers.CharField()
    is_complete = serializers.BooleanField()


class StatementTotalsSerializer(serializers.Serializer):
    revenue = money()
    cogs = money()
    operating_expenses = money()
    net_profit = money()


class StatementLineSerializer(serializers.Serializer):
    key = serializers.CharField()
    label = serializers.CharField()
    level = serializers.ChoiceField(['item', 'sub', 'sum', 'total'])
    amount = money(help_text='Koszty są ujemne.')
    previous = money()


class StatementTrendSerializer(serializers.Serializer):
    label = serializers.CharField()
    start = serializers.DateField()
    revenue = money()
    costs = money()
    net_profit = money()


class StatementDaySerializer(serializers.Serializer):
    date = serializers.DateField()
    net_profit = money()


class StatementSerializer(serializers.Serializer):
    period = StatementPeriodSerializer()
    totals = StatementTotalsSerializer()
    previous_totals = StatementTotalsSerializer()
    gross_margin = money()
    previous_gross_margin = money()
    gross_margin_pct = serializers.FloatField(allow_null=True)
    net_margin_pct = serializers.FloatField(allow_null=True)
    lines = StatementLineSerializer(many=True, help_text='Wiersze rachunku zysków i strat.')
    trend = StatementTrendSerializer(many=True)
    days = StatementDaySerializer(many=True, help_text='Tylko dla okresu month.')


class ClosedAmountsSerializer(StatementTotalsSerializer):
    closed_by = serializers.CharField(allow_null=True)
    closed_at = serializers.DateTimeField()


class ClosingDaySerializer(StatementTotalsSerializer):
    date = serializers.DateField()
    closed = ClosedAmountsSerializer(allow_null=True, help_text='Kwoty zapisane przy zamknięciu dnia.')
    drift = money(allow_null=True, help_text='O ile zysk liczony dziś różni się od zapisanego przy zamknięciu.')


class CloseDayInputSerializer(serializers.Serializer):
    date = serializers.DateField()


class SupplierProductInputSerializer(serializers.Serializer):
    product_id = serializers.IntegerField(help_text='Id surowca.')
    last_price = money(required=False, allow_null=True, help_text='Cena za jednostkę surowca.')
    is_assigned = serializers.BooleanField(required=False, help_text='Domyślnie true.')


class SupplierInputSerializer(SupplierSerializer):
    products = SupplierProductInputSerializer(
        many=True, required=False, help_text='Asortyment dostawcy – surowce spoza listy zostają odpięte.',
    )


class PriceInputSerializer(serializers.Serializer):
    current_price = money(allow_null=True)


class PriceResultSerializer(serializers.Serializer):
    ingredient_id = serializers.IntegerField()
    ingredient = serializers.CharField()
    current_price = money(allow_null=True)
