from django.urls import path
from .views import ClientDetailView, ClientGeocodeView, ClientListCreateView, GeocodePreviewView, RouteListView

urlpatterns = [
    path('', ClientListCreateView.as_view(), name='client-list-create'),
    path('routes/', RouteListView.as_view(), name='route-list'),
    path('geocode/', GeocodePreviewView.as_view(), name='client-geocode-preview'),
    path('<int:pk>/', ClientDetailView.as_view(), name='client-detail'),
    path('<int:pk>/geocode/', ClientGeocodeView.as_view(), name='client-geocode'),
]