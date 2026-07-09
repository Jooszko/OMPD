from django.urls import path
from .views import DashboardView, LogisticsView, UpdateOrderStatusView

urlpatterns = [
    path('dashboard/', DashboardView.as_view(), name='dashboard'),
    path('logistics/', LogisticsView.as_view(), name='logistics'),
    path('logistics/orders/<int:pk>/status/', UpdateOrderStatusView.as_view(), name='logistics-order-status'),
]
