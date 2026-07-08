from django.urls import path
from .views import SupplierListView, SupplierDetailView

urlpatterns = [
    path('suppliers/', SupplierListView.as_view(), name='supplier-list'),
    
    path('suppliers/<int:pk>/', SupplierDetailView.as_view(), name='supplier-detail'),
]