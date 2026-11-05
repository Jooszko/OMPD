from decimal import Decimal

from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from audit.services import field_changes, record_event
from finance.models import SupplierIngredient
from production.services import recipes
from users.permissions import AdminOnly, AdminOrBaker
from users.models import Notification, User
from .models import Ingredient, IngredientStock, Product, Recipe, StockMovement
from .serializers import (
    IngredientCreateSerializer,
    IngredientSerializer,
    ProductSerializer,
    StockAdjustmentSerializer,
)
from .stock import StockError, adjust_stock, record_movement, stock_history, warehouse_row, warehouse_rows
from common.openapi import error_response
from .openapi import (
    RecipeCreateSerializer,
    RecipeSerializer,
    RecipeUpdateSerializer,
    StockHistorySerializer,
    WarehouseRowSerializer,
    WarehouseSerializer,
)

PRODUCT_AUDIT_LABELS = {'name': 'Nazwa', 'category': 'Kategoria', 'base_price': 'Cena'}
INGREDIENT_AUDIT_LABELS = {'name': 'Nazwa', 'unit': 'Jednostka'}
STOCK_EVENT_DESCRIPTIONS = {
    StockMovement.KIND_DELIVERY: 'Przyjęto {amount} {unit} surowca {name}.',
    StockMovement.KIND_LOSS: 'Rozchód {amount} {unit} surowca {name}.',
    StockMovement.KIND_COUNT: 'Inwentaryzacja surowca {name}: stan {balance} {unit}.',
}
HISTORY_DEFAULT_DAYS = 90
VALIDATION_ERROR = OpenApiResponse(description='Błędy walidacji: słownik pole → lista komunikatów.')
NOT_FOUND = OpenApiResponse(description='Nie znaleziono produktu.')
INGREDIENT_NOT_FOUND = OpenApiResponse(description='Nie znaleziono surowca.')


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
        description=(
            'Tworzy surowiec razem ze stanem magazynowym, opcjonalnie od razu ze stanem początkowym. '
            'Próg minimalny liczy się sam z zużycia w produkcji. Tylko administrator.'
        ),
        request=IngredientCreateSerializer,
        responses={201: WarehouseRowSerializer, 400: VALIDATION_ERROR},
    )
    def post(self, request):
        serializer = IngredientCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        initial = serializer.validated_data.pop('current_stock', Decimal('0'))
        price = serializer.validated_data.pop('current_price', None)
        with transaction.atomic():
            ingredient = serializer.save()
            IngredientStock.objects.create(ingredient=ingredient, current_price=price)
            record_movement(ingredient.pk, StockMovement.KIND_INITIAL, initial, user=request.user)
            record_event(
                request, category='products', action='ingredient.created', obj=ingredient,
                object_label=ingredient.name,
                description=f'Dodano składnik {ingredient.name} ({ingredient.unit}) do bazy surowców.',
                changes=[
                    {'field': 'name', 'label': 'Nazwa', 'old': None, 'new': ingredient.name},
                    {'field': 'unit', 'label': 'Jednostka', 'old': None, 'new': ingredient.unit},
                    {'field': 'current_stock', 'label': 'Stan początkowy', 'old': None, 'new': str(initial)},
                    *(
                        [{
                            'field': 'current_price',
                            'label': 'Cena magazynowa',
                            'old': None,
                            'new': _price(price, ingredient.unit),
                        }]
                        if price is not None else []
                    ),
                ],
            )
        return Response(warehouse_row(ingredient), status=status.HTTP_201_CREATED)


def _amount(value):
    return f'{value.normalize():f}'


def _price(value, unit):
    return f'{value} zł/{unit}' if value is not None else 'brak'


def _ingredient_state(ingredient):
    return {'name': ingredient.name, 'unit': ingredient.unit}


class WarehouseView(APIView):
    permission_classes = [AdminOrBaker]

    @extend_schema(
        summary='Magazyn surowców',
        description=(
            'Surowce ze stanem, progiem minimalnym (zużycie w produkcji z ostatnich 7 dni), '
            'średnim dziennym zużyciem z 7 dni i zapasem w dniach.'
        ),
        responses={200: WarehouseSerializer},
    )
    def get(self, request):
        return Response({'items': warehouse_rows()}, status=status.HTTP_200_OK)


class IngredientDetailView(APIView):
    permission_classes = [AdminOnly]

    @extend_schema(
        summary='Zmiana surowca',
        description='Nazwa i jednostka. Stan zmienia się przez ruchy magazynowe, próg minimalny liczy się sam. Tylko administrator.',
        request=IngredientSerializer,
        responses={200: WarehouseRowSerializer, 400: VALIDATION_ERROR, 404: INGREDIENT_NOT_FOUND},
    )
    def patch(self, request, pk):
        ingredient = get_object_or_404(Ingredient.objects.select_related('stock'), pk=pk)
        serializer = IngredientSerializer(ingredient, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        before = _ingredient_state(ingredient)
        with transaction.atomic():
            ingredient = serializer.save()
            changes = field_changes(before, _ingredient_state(ingredient), INGREDIENT_AUDIT_LABELS)
            if changes:
                record_event(
                    request, category='products', action='ingredient.updated', obj=ingredient,
                    object_label=ingredient.name, changes=changes,
                    description=f'Zmieniono surowiec {ingredient.name}.',
                )
        return Response(warehouse_row(ingredient), status=status.HTTP_200_OK)


class IngredientStockView(APIView):
    permission_classes = [AdminOrBaker]

    @extend_schema(
        summary='Zmiana stanu surowca',
        description=(
            'delivery – przyjęcie dostawy (dodaje ilość), loss – rozchód lub strata (odejmuje), '
            'count – inwentaryzacja (ustawia policzony stan). Zapisuje ruch w historii magazynu.'
        ),
        request=StockAdjustmentSerializer,
        responses={
            200: WarehouseRowSerializer,
            400: VALIDATION_ERROR,
            404: INGREDIENT_NOT_FOUND,
            409: error_response('Rozchód większy niż stan.'),
        },
    )
    def post(self, request, pk):
        ingredient = get_object_or_404(Ingredient, pk=pk)
        serializer = StockAdjustmentSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        unit_price = None
        note = data['note']
        if data['kind'] == StockMovement.KIND_DELIVERY and data['supplier_id'] is None:
            if data['unit_price'] is None:
                return Response(
                    {'supplier_id': ['Wybierz dostawcę albo dostawę własną z ceną.']},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            unit_price = data['unit_price']
            note = ' · '.join(filter(None, ['Dostawa własna', note]))[:200]
        elif data['kind'] == StockMovement.KIND_DELIVERY:
            offer = SupplierIngredient.objects.select_related('supplier').filter(
                ingredient=ingredient, supplier_id=data['supplier_id'], is_assigned=True, supplier__is_active=True,
            ).first()
            if offer is None:
                return Response(
                    {'supplier_id': ['Wybierz aktywnego dostawcę tego surowca.']}, status=status.HTTP_400_BAD_REQUEST
                )
            if offer.last_price is None:
                return Response(
                    {'supplier_id': ['Ten dostawca nie ma ceny tego surowca. Uzupełnij ją w Kontrahentach.']},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            unit_price = offer.last_price
            note = ' · '.join(filter(None, [offer.supplier.name, note]))[:200]

        with transaction.atomic():
            price_before = (
                IngredientStock.objects.filter(ingredient=ingredient).values_list('current_price', flat=True).first()
            )
            try:
                movement = adjust_stock(
                    ingredient, data['kind'], data['quantity'], user=request.user, note=note,
                    unit_price=unit_price,
                )
            except StockError as error:
                return Response({'error': str(error)}, status=status.HTTP_409_CONFLICT)
            price_after = IngredientStock.objects.get(ingredient=ingredient).current_price
            before = movement.balance_after - movement.quantity
            changes = [{
                'field': 'current_stock', 'label': 'Stan magazynowy',
                'old': f'{before} {ingredient.unit}', 'new': f'{movement.balance_after} {ingredient.unit}',
            }]
            if price_after != price_before:
                changes.append({
                    'field': 'current_price', 'label': 'Cena magazynowa',
                    'old': _price(price_before, ingredient.unit), 'new': _price(price_after, ingredient.unit),
                })
            record_event(
                request, category='products', action=f'stock.{movement.kind}', obj=ingredient,
                object_label=ingredient.name,
                description=STOCK_EVENT_DESCRIPTIONS[movement.kind].format(
                    name=ingredient.name, unit=ingredient.unit,
                    amount=_amount(abs(movement.quantity)), balance=_amount(movement.balance_after),
                ) + (f' {movement.note}' if movement.note else ''),
                changes=changes,
            )
            if movement.kind == StockMovement.KIND_DELIVERY:
                admins = User.objects.filter(role='admin')
                Notification.objects.bulk_create([
                    Notification(
                        user=admin,
                        sender=request.user,
                        title='Przyjęto nową dostawę',
                        message=f'Przyjęto {_amount(abs(movement.quantity))} {ingredient.unit} surowca: {ingredient.name}.',
                    )
                    for admin in admins
                ])
        return Response(warehouse_row(ingredient), status=status.HTTP_200_OK)


class IngredientHistoryView(APIView):
    permission_classes = [AdminOrBaker]

    @extend_schema(
        summary='Historia stanu surowca',
        description='Stan na koniec każdego dnia (do wykresu) oraz ostatnie ruchy magazynowe z okresu.',
        parameters=[OpenApiParameter('days', int, description='Liczba dni wstecz, 7–365. Domyślnie 90.')],
        responses={200: StockHistorySerializer, 404: INGREDIENT_NOT_FOUND},
    )
    def get(self, request, pk):
        ingredient = get_object_or_404(Ingredient.objects.select_related('stock'), pk=pk)
        try:
            days = int(request.query_params.get('days', HISTORY_DEFAULT_DAYS))
        except ValueError:
            days = HISTORY_DEFAULT_DAYS
        days = min(max(days, 7), 365)
        return Response(stock_history(ingredient, days), status=status.HTTP_200_OK)


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

    def get_permissions(self):
        if self.request.method == 'DELETE':
            return [AdminOnly()]
        return [permission() for permission in self.permission_classes]

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

    @extend_schema(
        summary='Usunięcie produktu wraz z recepturą',
        description='Usuwa produkt i jego recepturę, jeśli nie jest używany w zamówieniach ani produkcji.',
        responses={
            204: OpenApiResponse(description='Usunięto produkt i recepturę.'),
            404: NOT_FOUND,
            409: error_response('Produktu używają zamówienia lub dane produkcyjne.'),
        },
    )
    def delete(self, request, pk):
        product = get_object_or_404(Product, pk=pk)
        has_references = any(
            relation.exists()
            for relation in (
                product.standing_orders,
                product.daily_orders,
                product.returns,
                product.plan_lines,
                product.batch_outputs,
                product.waste_records,
            )
        )
        if has_references:
            return Response(
                {'error': 'Nie można usunąć produktu używanego w zamówieniach lub produkcji.'},
                status=status.HTTP_409_CONFLICT,
            )

        with transaction.atomic():
            record_event(
                request, category='products', action='product.deleted', obj=product,
                object_label=product.name,
                description=f'Usunięto produkt {product.name} wraz z jego recepturą.',
                changes=[{'field': 'name', 'label': 'Nazwa produktu', 'old': product.name, 'new': None}],
            )
            product.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


def _recipe_items(amounts, ingredients):
    return [
        {
            'ingredient_id': ingredient_id,
            'ingredient_name': ingredients[ingredient_id].name,
            'unit': ingredients[ingredient_id].unit,
            'amount': str(amount),
        }
        for ingredient_id, amount in sorted(amounts.items(), key=lambda item: ingredients[item[0]].name)
    ]


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
    breakdown = recipes.recipe_breakdown(product)
    dough = None
    if breakdown is not None:
        ingredients = Ingredient.objects.in_bulk(set(breakdown['dough_items']) | set(breakdown['additions']))
        dough = {
            'dough_id': breakdown['dough_id'],
            'dough_name': breakdown['dough_name'],
            'piece_weight_kg': str(breakdown['piece_weight_kg']),
            'dough_items': _recipe_items(breakdown['dough_items'], ingredients),
            'additions': _recipe_items(breakdown['additions'], ingredients),
        }
    return {
        'product_id': product.product_id,
        'name': product.name,
        'category': product.category,
        'items': items,
        'dough': dough,
    }


def _parse_additions(items):
    """{ingredient_id: ilość} z listy dodatków albo komunikat błędu."""
    additions = {}
    for item in items:
        try:
            ingredient_id = int(item['ingredient_id'])
            amount = Decimal(str(item['amount']))
        except (KeyError, TypeError, ValueError, ArithmeticError):
            return None, 'Każdy dodatek musi mieć surowiec i ilość.'
        if amount <= 0:
            return None, 'Ilość dodatku musi być większa od zera.'
        if ingredient_id in additions:
            return None, 'Każdy surowiec może wystąpić w dodatkach tylko raz.'
        additions[ingredient_id] = amount.quantize(recipes.RECIPE_PRECISION)
    missing = set(additions) - set(Ingredient.objects.filter(pk__in=additions).values_list('pk', flat=True))
    if missing:
        return None, 'Wybrany surowiec nie istnieje.'
    return additions, None


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

        if recipes.bake_spec_of(product) is not None:
            return self._save_additions(request, product, items)

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

    @staticmethod
    def _save_additions(request, product, items):
        """Wyrób z ciastem: zmienia się tylko dodatki, część z ciasta wylicza się sama."""
        additions, error = _parse_additions(items)
        if error:
            return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)
        spec = recipes.bake_spec_of(product)
        conflicts = recipes.dough_conflicts(spec, additions)
        if conflicts:
            names = ', '.join(sorted(Ingredient.objects.filter(pk__in=conflicts).values_list('name', flat=True)))
            return Response({'error': (
                f'Surowce ze składu ciasta {spec.dough.name} nie mogą być dodatkami: {names}. '
                'Dodatek to surowiec dokładany poza ciastem, np. nadzienie albo posypka.'
            )}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            recipes.set_additions(product, additions)
            recipes.rebuild_recipe(
                product, request, action='recipe.updated',
                description=f'Zmieniono dodatki w recepturze produktu {product.name}.',
            )
        return Response(_serialize_recipe(product), status=status.HTTP_200_OK)

    @extend_schema(
        summary='Usunięcie receptury',
        description=(
            'Usuwa recepturę – produkt zostaje. Dla wyrobu z ciastem usuwa tylko dodatki: '
            'receptura wraca do samej części z ciasta.'
        ),
        responses={204: OpenApiResponse(description='Usunięto.'), 404: NOT_FOUND},
    )
    def delete(self, request, product_id):
        product = get_object_or_404(Product, pk=product_id)
        if recipes.bake_spec_of(product) is not None:
            with transaction.atomic():
                recipes.set_additions(product, {})
                recipes.rebuild_recipe(
                    product, request, action='recipe.updated',
                    description=f'Usunięto dodatki z receptury produktu {product.name}.',
                )
            return Response(status=status.HTTP_204_NO_CONTENT)
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