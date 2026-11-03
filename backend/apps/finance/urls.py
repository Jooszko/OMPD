from django.urls import path
from .views import (
    SupplierListView,
    SupplierDetailView,
    ExpenseListCreateView,
    ExpenseDetailView,
    RecurringExpenseListView,
    RecurringExpenseDetailView,
    FinanceOverviewView,
    ProfitabilityView,
    StatementView,
    ClosingListView,
    ClosingDetailView,
    FinanceExportView,
    IngredientPriceView,
)

urlpatterns = [
    path('suppliers/', SupplierListView.as_view(), name='supplier-list'),
    path('suppliers/<int:pk>/', SupplierDetailView.as_view(), name='supplier-detail'),
    path('overview/', FinanceOverviewView.as_view(), name='finance-overview'),
    path('profitability/', ProfitabilityView.as_view(), name='finance-profitability'),
    path('statement/', StatementView.as_view(), name='finance-statement'),
    path('closings/', ClosingListView.as_view(), name='finance-closings'),
    path('closings/<str:day>/', ClosingDetailView.as_view(), name='finance-closing-detail'),
    path('exports/<str:kind>/', FinanceExportView.as_view(), name='finance-export'),
    path('ingredient-prices/<int:pk>/', IngredientPriceView.as_view(), name='finance-ingredient-price'),
    path('expenses/', ExpenseListCreateView.as_view(), name='finance-expenses'),
    path('expenses/<int:pk>/', ExpenseDetailView.as_view(), name='finance-expense-detail'),
    path('recurring-expenses/', RecurringExpenseListView.as_view(), name='finance-recurring-expenses'),
    path('recurring-expenses/<int:pk>/', RecurringExpenseDetailView.as_view(), name='finance-recurring-expense-detail'),
]
