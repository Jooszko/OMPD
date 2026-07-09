from django.urls import path
from .views import (
    SupplierListView,
    SupplierDetailView,
    DailySummaryView,
    ExpenseListCreateView,
    CategoryBreakdownView,
    PeriodIncomesView,
    TopClientsView,
    ProfitTrendView,
    FinancialReportListView,
    FinancialReportDetailView,
)

urlpatterns = [
    path('suppliers/', SupplierListView.as_view(), name='supplier-list'),
    path('suppliers/<int:pk>/', SupplierDetailView.as_view(), name='supplier-detail'),

    path('daily-summary/', DailySummaryView.as_view(), name='finance-daily-summary'),
    path('expenses/', ExpenseListCreateView.as_view(), name='finance-expenses'),
    path('category-breakdown/', CategoryBreakdownView.as_view(), name='finance-category-breakdown'),
    path('period-incomes/', PeriodIncomesView.as_view(), name='finance-period-incomes'),
    path('top-clients/', TopClientsView.as_view(), name='finance-top-clients'),
    path('profit-trend/', ProfitTrendView.as_view(), name='finance-profit-trend'),
    path('reports/', FinancialReportListView.as_view(), name='finance-reports'),
    path('reports/<str:report_date>/', FinancialReportDetailView.as_view(), name='finance-report-detail'),
]
