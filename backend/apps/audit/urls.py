from django.urls import path

from .views import AuditEntryListView, AuditFiltersView

urlpatterns = [
    path('', AuditEntryListView.as_view(), name='audit-list'),
    path('filters/', AuditFiltersView.as_view(), name='audit-filters'),
]