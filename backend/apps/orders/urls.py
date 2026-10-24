from django.urls import path
from .views import DailyOrdersView, OrderDayView, StandingOrdersView, StandingOrdersDueView, OrderHistoryView

urlpatterns = [
    path('daily/', DailyOrdersView.as_view(), name='daily-orders'),
    path('day/', OrderDayView.as_view(), name='order-day'),
    path('standing/', StandingOrdersView.as_view(), name='standing-orders'),
    path('standing/due/', StandingOrdersDueView.as_view(), name='standing-orders-due'),
    path('history/', OrderHistoryView.as_view(), name='order-history'),
]
