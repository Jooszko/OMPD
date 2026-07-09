from django.urls import path
from .views import ClientListCreateView, ClientDetailView, RouteListView

urlpatterns = [
    path('', ClientListCreateView.as_view(), name='client-list-create'),
    path('routes/', RouteListView.as_view(), name='route-list'),
    path('<int:pk>/', ClientDetailView.as_view(), name='client-detail'),
]
