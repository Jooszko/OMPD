from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from drf_spectacular.utils import OpenApiResponse, extend_schema
from audit.services import field_changes, record_event
from users.permissions import AdminOnly, AdminOrBaker
from .models import Ingredient, IngredientStock, Product, Recipe
from .serializers import IngredientSerializer, ProductSerializer
from common.openapi import error_response
from .openapi import RecipeCreateSerializer, RecipeSerializer, RecipeUpdateSerializer

PRODUCT_AUDIT_LABELS = {'name': 'Nazwa', 'category': 'Kategoria', 'base_price': 'Cena'}
VALIDATION_ERROR = OpenApiResponse(description='Błędy walidacji: słownik pole → lista komunikatów.')
NOT_FOUND = OpenApiResponse(description='Nie znaleziono produktu.')


def _product_state(product):
    return {
        'name': product.name,
        'category': product.get_category_display(),
        'base_price': str(product.base_price),
    }


def _recipe_state(product):
    """{ingredient name: 'amount unit'} for the product's current recipe."""
    return {
        r.ingredient.name: f'{r.amount} {r.ingredient.unit}'
        for r in Recipe.objects.filter(product=product).select_related('ingredient')
    }


def _recipe_changes(before, after):
    names = sorted(set(before) | set(after))
    return field_changes(before, after, {name: name for name in names})


class IngredientListView(APIView):
    def get_permissions(self):
        if self.request.method == 'POST':
            return [AdminOnly()]
        return [AdminOrBaker()]

    @extend_schema(
        summary='Lista surowców',
        responses={200: IngredientSerializer(many=True)},
    )
    def get(self, request):
        ingredients = Ingredient.objects.all().order_by('name')
        serializer = IngredientSerializer(ingredients, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary='Dodanie surowca',
        description='Tworzy też pusty stan magazynowy surowca. Tylko administrator.',
        request=IngredientSerializer,
        responses={201: IngredientSerializer, 400: VALIDATION_ERROR},
    )
    def post(self, request):
        serializer = IngredientSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            ingredient = serializer.save()
            IngredientStock.objects.create(ingredient=ingredient)
            record_event(
                request, category='products', action='ingredient.created', obj=ingredient,
                object_label=ingredient.name,
                description=f'Dodano składnik {ingredient.name} ({ingredient.unit}) do bazy surowców.',
                changes=[
                    {'field': 'name', 'label': 'Nazwa', 'old': None, 'new': ingredient.name},
                    {'field': 'unit', 'label': 'Jednostka', 'old': None, 'new': ingredient.unit},
                ],
            )
        return Response(IngredientSerializer(ingredient).data, status=status.HTTP_201_CREATED)


class ProductListView(APIView):
    permission_classes = [AdminOrBaker]

    @extend_schema(
        summary='Lista produktów',
        responses={200: ProductSerializer(many=True)},
    )
    def get(self, request):
        products = Product.objects.all().order_by('name')
        serializer = ProductSerializer(products, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ProductDetailView(APIView):
    permission_classes = [AdminOrBaker]

    @extend_schema(
        summary='Zmiana produktu',
        description='Zmienia tylko przesłane pola, np. samą cenę.',
        request=ProductSerializer,
        responses={200: ProductSerializer, 400: VALIDATION_ERROR, 404: NOT_FOUND},
    )
    def patch(self, request, pk):
        product = get_object_or_404(Product, pk=pk)
        serializer = ProductSerializer(product, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        before = _product_state(product)
        with transaction.atomic():
            product = serializer.save()
            changes = field_changes(before, _product_state(product), PRODUCT_AUDIT_LABELS)
            if changes:
                only_price = [c['field'] for c in changes] == ['base_price']
                record_event(
                    request, category='products',
                    action='product.price_changed' if only_price else 'product.updated',
                    obj=product, object_label=product.name, changes=changes,
                    description=(
                        f'Zmieniono cenę produktu {product.name}.' if only_price
                        else f'Zmieniono produkt {product.name}.'
                    ),
                )
        return Response(serializer.data, status=status.HTTP_200_OK)


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
    permission_classes = [AdminOrBaker]

    @extend_schema(
        summary='Receptury produktów',
        description='Produkty, które mają recepturę, ze składem na jedną sztukę.',
        responses={200: RecipeSerializer(many=True)},
    )
    def get(self, request):
        products = (
            Product.objects
            .prefetch_related('recipe_set__ingredient')
            .filter(recipe__isnull=False)
            .distinct()
            .order_by('name')
        )
        return Response([_serialize_recipe(p) for p in products], status=status.HTTP_200_OK)

    @extend_schema(
        summary='Nowy produkt z recepturą',
        description='Tworzy produkt (z ceną 0 do uzupełnienia) razem z recepturą.',
        request=RecipeCreateSerializer,
        responses={201: RecipeSerializer, 400: error_response('Brak nazwy lub składników.')},
    )
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
            record_event(
                request, category='products', action='recipe.created', obj=product, object_label=product.name,
                description=f'Dodano produkt {product.name} z recepturą ({len(items)} składn.).',
                changes=_recipe_changes({}, _recipe_state(product)),
            )

        return Response(_serialize_recipe(product), status=status.HTTP_201_CREATED)


class RecipeDetailView(APIView):
    permission_classes = [AdminOrBaker]

    @extend_schema(
        summary='Zmiana receptury',
        request=RecipeUpdateSerializer,
        responses={
            200: RecipeSerializer,
            400: error_response('Receptura bez składników.'),
            404: NOT_FOUND,
        },
    )
    def put(self, request, product_id):
        product = get_object_or_404(Product, pk=product_id)
        items = request.data.get('items', [])

        if not items:
            return Response(
                {'error': 'Receptura musi zawierać co najmniej jeden składnik.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            before = _recipe_state(product)
            Recipe.objects.filter(product=product).delete()
            for item in items:
                Recipe.objects.create(
                    product=product,
                    ingredient_id=item['ingredient_id'],
                    amount=item['amount'],
                )
            changes = _recipe_changes(before, _recipe_state(product))
            if changes:
                record_event(
                    request, category='products', action='recipe.updated', obj=product, object_label=product.name,
                    description=f'Zmieniono recepturę produktu {product.name}.', changes=changes,
                )

        return Response(_serialize_recipe(product), status=status.HTTP_200_OK)

    @extend_schema(
        summary='Usunięcie receptury',
        description='Usuwa tylko recepturę – produkt zostaje.',
        responses={204: OpenApiResponse(description='Usunięto.'), 404: NOT_FOUND},
    )
    def delete(self, request, product_id):
        product = get_object_or_404(Product, pk=product_id)
        with transaction.atomic():
            before = _recipe_state(product)
            Recipe.objects.filter(product=product).delete()
            if before:
                record_event(
                    request, category='products', action='recipe.deleted', obj=product, object_label=product.name,
                    description=f'Usunięto recepturę produktu {product.name}.',
                    changes=_recipe_changes(before, {}),
                )
        return Response(status=status.HTTP_204_NO_CONTENT)