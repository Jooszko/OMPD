from django.urls import path
from .views import (
    IngredientListView,
    ProductListView,
    ProductDetailView,
    RecipeListCreateView,
    RecipeDetailView,
)

urlpatterns = [
    path('', ProductListView.as_view(), name='product-list'),
    path('ingredients/', IngredientListView.as_view(), name='ingredient-list'),
    path('recipes/', RecipeListCreateView.as_view(), name='recipe-list-create'),
    path('recipes/<int:product_id>/', RecipeDetailView.as_view(), name='recipe-detail'),
    path('<int:pk>/', ProductDetailView.as_view(), name='product-detail'),
]
