from django.urls import path
from .views import (
    DashboardView,
    DeliverStopView,
    LogisticsView,
    ReportOrderProblemView,
    ReportStopProblemView,
    RouteDirectionsView,
    StopDeliveryNoteView,
    UpdateOrderStatusView,
    WithdrawProblemView,
)

urlpatterns = [
    path('dashboard/', DashboardView.as_view(), name='dashboard'),
    path('logistics/', LogisticsView.as_view(), name='logistics'),
    path('logistics/orders/<int:pk>/status/', UpdateOrderStatusView.as_view(), name='logistics-order-status'),
    path('logistics/clients/<int:pk>/deliver/', DeliverStopView.as_view(), name='logistics-deliver-stop'),
    path('logistics/clients/<int:pk>/report-problem/', ReportStopProblemView.as_view(), name='logistics-report-stop-problem'),
    path('logistics/orders/<int:pk>/report-problem/', ReportOrderProblemView.as_view(), name='logistics-report-order-problem'),
    path('logistics/clients/<int:pk>/delivery-note/', StopDeliveryNoteView.as_view(), name='logistics-stop-delivery-note'),
    path('logistics/problems/withdraw/', WithdrawProblemView.as_view(), name='logistics-withdraw-problem'),
    path('logistics/routes/<int:pk>/directions/', RouteDirectionsView.as_view(), name='route-directions'),
]
