from django.urls import path
from .views import DailyOrdersView, StandingOrdersView, OrderHistoryView

urlpatterns = [
    path('daily/', DailyOrdersView.as_view(), name='daily-orders'),
    path('standing/', StandingOrdersView.as_view(), name='standing-orders'),
    path('history/', OrderHistoryView.as_view(), name='order-history'),
]
