from django.urls import path
from .views import (
    IngredientDetailView,
    IngredientHistoryView,
    IngredientListView,
    IngredientStockView,
    ProductListView,
    ProductDetailView,
    RecipeListCreateView,
    RecipeDetailView,
    WarehouseView,
)

urlpatterns = [
    path('', ProductListView.as_view(), name='product-list'),
    path('warehouse/', WarehouseView.as_view(), name='warehouse'),
    path('ingredients/', IngredientListView.as_view(), name='ingredient-list'),
    path('ingredients/<int:pk>/', IngredientDetailView.as_view(), name='ingredient-detail'),
    path('ingredients/<int:pk>/stock/', IngredientStockView.as_view(), name='ingredient-stock'),
    path('ingredients/<int:pk>/history/', IngredientHistoryView.as_view(), name='ingredient-history'),
    path('recipes/', RecipeListCreateView.as_view(), name='recipe-list-create'),
    path('recipes/<int:product_id>/', RecipeDetailView.as_view(), name='recipe-detail'),
    path('<int:pk>/', ProductDetailView.as_view(), name='product-detail'),
]
