from django.urls import path
from .views import (
    DashboardView,
    DeliveryProofDetailView,
    DeliveryProofFileView,
    DeliveryStatsView,
    DeliverStopView,
    LogisticsView,
    ReportOrderProblemView,
    ReportStopProblemView,
    RouteDirectionsView,
    StopDeliveryNoteView,
    StopDeliveryProofView,
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
    path('logistics/clients/<int:pk>/proofs/', StopDeliveryProofView.as_view(), name='logistics-stop-proofs'),
    path('logistics/proofs/<int:pk>/', DeliveryProofDetailView.as_view(), name='logistics-proof-detail'),
    path('delivery-stats/', DeliveryStatsView.as_view(), name='delivery-stats'),
    path('logistics/proofs/<int:pk>/file/', DeliveryProofFileView.as_view(), name='logistics-proof-file'),
    path('logistics/routes/<int:pk>/directions/', RouteDirectionsView.as_view(), name='route-directions'),
]
