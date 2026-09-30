from django.urls import path
from .views import DashboardView, DeliverStopView, LogisticsView, RouteDirectionsView, UpdateOrderStatusView

urlpatterns = [
    path('dashboard/', DashboardView.as_view(), name='dashboard'),
    path('logistics/', LogisticsView.as_view(), name='logistics'),
    path('logistics/orders/<int:pk>/status/', UpdateOrderStatusView.as_view(), name='logistics-order-status'),
    path('logistics/clients/<int:pk>/deliver/', DeliverStopView.as_view(), name='logistics-deliver-stop'),
    path('logistics/routes/<int:pk>/directions/', RouteDirectionsView.as_view(), name='route-directions'),
]
