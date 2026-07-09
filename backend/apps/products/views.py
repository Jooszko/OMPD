from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .models import Ingredient, Product, Recipe
from .serializers import IngredientSerializer, ProductSerializer


class IngredientListView(APIView):
    def get(self, request):
        ingredients = Ingredient.objects.all().order_by('name')
        serializer = IngredientSerializer(ingredients, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ProductListView(APIView):
    def get(self, request):
        products = Product.objects.all().order_by('name')
        serializer = ProductSerializer(products, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ProductDetailView(APIView):
    def patch(self, request, pk):
        product = get_object_or_404(Product, pk=pk)
        serializer = ProductSerializer(product, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


def _serialize_recipe(product):
    items = [
        {
            'ingredient_id': r.ingredient_id,
            'ingredient_name': r.ingredient.name,
            'unit': r.ingredient.unit,
            'amount': str(r.amount),
        }
        for r in product.recipe_set.select_related('ingredient').all()
    ]
    return {
        'product_id': product.product_id,
        'name': product.name,
        'category': product.category,
        'items': items,
    }


class RecipeListCreateView(APIView):
    def get(self, request):
        products = (
            Product.objects
            .prefetch_related('recipe_set__ingredient')
            .filter(recipe__isnull=False)
            .distinct()
            .order_by('name')
        )
        return Response([_serialize_recipe(p) for p in products], status=status.HTTP_200_OK)

    def post(self, request):
        name = request.data.get('name', '').strip()
        category = request.data.get('category', 'other')
        items = request.data.get('items', [])

        if not name or not items:
            return Response(
                {'error': 'Nazwa produktu oraz co najmniej jeden składnik są wymagane.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            product = Product.objects.create(name=name, category=category, base_price=0)
            for item in items:
                Recipe.objects.create(
                    product=product,
                    ingredient_id=item['ingredient_id'],
                    amount=item['amount'],
                )

        return Response(_serialize_recipe(product), status=status.HTTP_201_CREATED)


class RecipeDetailView(APIView):
    def put(self, request, product_id):
        product = get_object_or_404(Product, pk=product_id)
        items = request.data.get('items', [])

        if not items:
            return Response(
                {'error': 'Receptura musi zawierać co najmniej jeden składnik.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            Recipe.objects.filter(product=product).delete()
            for item in items:
                Recipe.objects.create(
                    product=product,
                    ingredient_id=item['ingredient_id'],
                    amount=item['amount'],
                )

        return Response(_serialize_recipe(product), status=status.HTTP_200_OK)

    def delete(self, request, product_id):
        product = get_object_or_404(Product, pk=product_id)
        Recipe.objects.filter(product=product).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
