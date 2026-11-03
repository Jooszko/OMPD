from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from audit.models import AuditEntry
from clients.models import Client, Route
from finance.models import Supplier, SupplierIngredient
from orders.models import DailyOrder
from products.models import Ingredient, IngredientStock, Product, Recipe, StockMovement
from products.stock import recalculate_min_stock, record_movement, warehouse_row
from users.models import User


class IngredientCreateApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.admin = User.objects.create_user(
            username='admin_ingredient', password='x', role='admin', full_name='Admin'
        )
        self.baker = User.objects.create_user(
            username='baker_ingredient', password='x', role='baker', full_name='Baker'
        )

    def test_admin_can_create_ingredient_and_initial_stock(self):
        self.api.force_authenticate(self.admin)

        response = self.api.post(
            '/api/products/ingredients/', {'name': 'Zakwas', 'unit': 'kg'}, format='json'
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['name'], 'Zakwas')
        self.assertEqual(response.data['unit'], 'kg')
        ingredient = Ingredient.objects.get(pk=response.data['ingredient_id'])
        self.assertTrue(IngredientStock.objects.filter(ingredient=ingredient).exists())
        self.assertEqual(AuditEntry.objects.get(action='ingredient.created').object_id, str(ingredient.pk))

    def test_baker_cannot_create_ingredient(self):
        self.api.force_authenticate(self.baker)

        response = self.api.post(
            '/api/products/ingredients/', {'name': 'Zakwas', 'unit': 'kg'}, format='json'
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(Ingredient.objects.exists())

    def test_name_and_unit_are_required(self):
        self.api.force_authenticate(self.admin)

        response = self.api.post('/api/products/ingredients/', {'name': 'Zakwas'}, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertIn('unit', response.data)
        self.assertFalse(Ingredient.objects.exists())


class ProductDeleteApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.admin = User.objects.create_user(
            username='admin_product_delete', password='x', role='admin', full_name='Admin'
        )
        self.baker = User.objects.create_user(
            username='baker_product_delete', password='x', role='baker', full_name='Baker'
        )
        self.product = Product.objects.create(name='Chleb', category='bread', base_price=Decimal('5.00'))
        ingredient = Ingredient.objects.create(name='Mąka', unit='kg')
        Recipe.objects.create(product=self.product, ingredient=ingredient, amount=Decimal('1.000'))

    def test_admin_can_delete_product_and_recipe_from_product_endpoint(self):
        self.api.force_authenticate(self.admin)

        response = self.api.delete(f'/api/products/{self.product.pk}/')

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Product.objects.filter(pk=self.product.pk).exists())
        self.assertFalse(Recipe.objects.filter(product_id=self.product.pk).exists())
        self.assertEqual(AuditEntry.objects.get(action='product.deleted').object_id, str(self.product.pk))

    def test_product_used_by_orders_cannot_be_deleted(self):
        route = Route.objects.create(route_name='Trasa testowa')
        client = Client.objects.create(name='Sklep', address='Adres', route=route)
        DailyOrder.objects.create(
            client=client,
            product=self.product,
            order_date=date.today(),
            quantity=1,
            price_at_sale=Decimal('5.00'),
        )
        self.api.force_authenticate(self.admin)

        response = self.api.delete(f'/api/products/{self.product.pk}/')

        self.assertEqual(response.status_code, 409)
        self.assertTrue(Product.objects.filter(pk=self.product.pk).exists())
        self.assertTrue(Recipe.objects.filter(product_id=self.product.pk).exists())
        self.assertFalse(AuditEntry.objects.filter(action='product.deleted').exists())

    def test_baker_cannot_delete_product(self):
        self.api.force_authenticate(self.baker)

        response = self.api.delete(f'/api/products/{self.product.pk}/')

        self.assertEqual(response.status_code, 403)
        self.assertTrue(Product.objects.filter(pk=self.product.pk).exists())


class WarehouseApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.admin = User.objects.create_user(username='admin_wh', password='x', role='admin', full_name='Admin')
        self.baker = User.objects.create_user(username='baker_wh', password='x', role='baker', full_name='Piekarz')
        self.flour = Ingredient.objects.create(name='Mąka', unit='kg')
        IngredientStock.objects.create(
            ingredient=self.flour, current_stock=Decimal('100'), min_stock_level=Decimal('20'),
            current_price=Decimal('2.00'),
        )
        self.mill = Supplier.objects.create(name='Młyn')
        self.offer = SupplierIngredient.objects.create(
            supplier=self.mill, ingredient=self.flour, last_price=Decimal('3.00')
        )

    def _stock(self):
        return IngredientStock.objects.get(ingredient=self.flour).current_stock

    def _price(self):
        return IngredientStock.objects.get(ingredient=self.flour).current_price

    def _deliver(self, quantity, supplier_id):
        return self.api.post(
            f'/api/products/ingredients/{self.flour.pk}/stock/',
            {'kind': 'delivery', 'quantity': quantity, 'supplier_id': supplier_id}, format='json',
        )

    def test_admin_creates_ingredient_with_initial_stock(self):
        self.api.force_authenticate(self.admin)

        response = self.api.post(
            '/api/products/ingredients/',
            {'name': 'Siemię lniane', 'unit': 'kg', 'current_stock': '12.5', 'min_stock_level': '3'},
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Decimal(response.data['current_stock']), Decimal('12.5'))
        self.assertEqual(Decimal(response.data['min_stock_level']), Decimal('0'))
        movement = StockMovement.objects.get(ingredient_id=response.data['ingredient_id'])
        self.assertEqual(movement.kind, StockMovement.KIND_INITIAL)

        history = self.api.get(f"/api/products/ingredients/{response.data['ingredient_id']}/history/").data
        self.assertEqual(len(history['series']), 1)
        self.assertEqual(Decimal(history['series'][0]['balance']), Decimal('12.5'))

    def test_baker_records_delivery_loss_and_count(self):
        self.api.force_authenticate(self.baker)
        url = f'/api/products/ingredients/{self.flour.pk}/stock/'

        self.assertEqual(
            self.api.post(url, {'kind': 'delivery', 'quantity': '50', 'supplier_id': self.mill.pk}, format='json').status_code,
            200,
        )
        self.assertEqual(self._stock(), Decimal('150'))
        self.assertEqual(self.api.post(url, {'kind': 'loss', 'quantity': '10', 'note': 'Zawilgocony worek'}, format='json').status_code, 200)
        self.assertEqual(self._stock(), Decimal('140'))
        response = self.api.post(url, {'kind': 'count', 'quantity': '137.5'}, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(Decimal(response.data['current_stock']), Decimal('137.5'))
        self.assertEqual(
            list(StockMovement.objects.order_by('movement_id').values_list('quantity', flat=True)),
            [Decimal('50'), Decimal('-10'), Decimal('-2.5')],
        )
        self.assertEqual(AuditEntry.objects.filter(action__startswith='stock.').count(), 3)

    def test_delivery_updates_weighted_average_price(self):
        self.api.force_authenticate(self.baker)

        response = self._deliver('50', self.mill.pk)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self._stock(), Decimal('150'))
        self.assertEqual(self._price(), Decimal('2.33'))
        self.assertEqual(response.data['current_price'], '2.33')
        movement = StockMovement.objects.get(kind=StockMovement.KIND_DELIVERY)
        self.assertEqual(movement.note, 'Młyn')
        changes = AuditEntry.objects.get(action='stock.delivery').changes
        self.assertEqual(changes[1], {
            'field': 'current_price', 'label': 'Cena magazynowa', 'old': '2.00 zł/kg', 'new': '2.33 zł/kg',
        })

    def test_delivery_to_empty_stock_takes_supplier_price(self):
        IngredientStock.objects.filter(ingredient=self.flour).update(current_stock=Decimal('0'), current_price=None)
        self.api.force_authenticate(self.baker)

        self._deliver('10', self.mill.pk)

        self.assertEqual(self._price(), Decimal('3.00'))

    def test_loss_and_count_keep_price(self):
        self.api.force_authenticate(self.baker)
        url = f'/api/products/ingredients/{self.flour.pk}/stock/'

        self.api.post(url, {'kind': 'loss', 'quantity': '10'}, format='json')
        self.api.post(url, {'kind': 'count', 'quantity': '120'}, format='json')

        self.assertEqual(self._price(), Decimal('2.00'))

    def test_delivery_needs_active_assigned_supplier_with_price(self):
        self.api.force_authenticate(self.baker)
        idle = Supplier.objects.create(name='Stary młyn', is_active=False)
        SupplierIngredient.objects.create(supplier=idle, ingredient=self.flour, last_price=Decimal('1.00'))
        unassigned = Supplier.objects.create(name='Odpięty młyn')
        SupplierIngredient.objects.create(
            supplier=unassigned, ingredient=self.flour, last_price=Decimal('1.00'), is_assigned=False
        )
        unpriced = Supplier.objects.create(name='Młyn bez ceny')
        SupplierIngredient.objects.create(supplier=unpriced, ingredient=self.flour)

        for supplier_id in (None, idle.pk, unassigned.pk, unpriced.pk):
            with self.subTest(supplier_id=supplier_id):
                response = self._deliver('10', supplier_id)
                self.assertEqual(response.status_code, 400)
                self.assertIn('supplier_id', response.data)
        self.assertEqual(self._stock(), Decimal('100'))
        self.assertEqual(self._price(), Decimal('2.00'))

    def test_own_delivery_uses_entered_price(self):
        self.api.force_authenticate(self.baker)

        response = self.api.post(
            f'/api/products/ingredients/{self.flour.pk}/stock/',
            {'kind': 'delivery', 'quantity': '100', 'unit_price': '4.00', 'note': 'Makro'}, format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self._stock(), Decimal('200'))
        self.assertEqual(self._price(), Decimal('3.00'))
        self.assertEqual(StockMovement.objects.get(kind=StockMovement.KIND_DELIVERY).note, 'Dostawa własna · Makro')

    def test_own_delivery_needs_positive_price(self):
        self.api.force_authenticate(self.baker)

        for price in ('0', '-1', 'tanio'):
            with self.subTest(price=price):
                response = self.api.post(
                    f'/api/products/ingredients/{self.flour.pk}/stock/',
                    {'kind': 'delivery', 'quantity': '10', 'unit_price': price}, format='json',
                )
                self.assertEqual(response.status_code, 400)
        self.assertEqual(self._stock(), Decimal('100'))

    def test_warehouse_lists_active_assigned_suppliers(self):
        idle = Supplier.objects.create(name='Stary młyn', is_active=False)
        SupplierIngredient.objects.create(supplier=idle, ingredient=self.flour, last_price=Decimal('1.00'))
        self.api.force_authenticate(self.baker)

        row = self.api.get('/api/products/warehouse/').data['items'][0]

        self.assertEqual(row['current_price'], '2.00')
        self.assertEqual(row['suppliers'], [{'supplier_id': self.mill.pk, 'name': 'Młyn', 'price': '3.00'}])

    def test_loss_above_stock_is_rejected(self):
        self.api.force_authenticate(self.baker)

        response = self.api.post(
            f'/api/products/ingredients/{self.flour.pk}/stock/', {'kind': 'loss', 'quantity': '101'}, format='json'
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(self._stock(), Decimal('100'))

    def test_admin_renames_ingredient_but_cannot_set_minimum(self):
        url = f'/api/products/ingredients/{self.flour.pk}/'
        self.api.force_authenticate(self.baker)
        self.assertEqual(self.api.patch(url, {'name': 'Mąka pszenna'}, format='json').status_code, 403)

        self.api.force_authenticate(self.admin)
        response = self.api.patch(url, {'name': 'Mąka pszenna', 'min_stock_level': '40'}, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['name'], 'Mąka pszenna')
        self.assertEqual(Decimal(response.data['min_stock_level']), Decimal('20'))
        self.assertEqual(AuditEntry.objects.get(action='ingredient.updated').object_id, str(self.flour.pk))

    def test_warehouse_reports_daily_usage_and_days_left(self):
        record_movement(self.flour.pk, StockMovement.KIND_PRODUCTION, Decimal('-28'))
        self.api.force_authenticate(self.baker)

        row = self.api.get('/api/products/warehouse/').data['items'][0]

        self.assertEqual(Decimal(row['current_stock']), Decimal('72'))
        self.assertEqual(Decimal(row['daily_usage']), Decimal('4'))
        self.assertEqual(row['days_left'], 18.0)

    def test_minimum_is_production_usage_from_last_seven_days(self):
        now = timezone.now()
        record_movement(self.flour.pk, StockMovement.KIND_PRODUCTION, Decimal('-30'), at=now - timedelta(days=2))
        record_movement(self.flour.pk, StockMovement.KIND_PRODUCTION, Decimal('-12.5'), at=now - timedelta(hours=1))
        record_movement(self.flour.pk, StockMovement.KIND_PRODUCTION, Decimal('-40'), at=now - timedelta(days=8))
        record_movement(self.flour.pk, StockMovement.KIND_LOSS, Decimal('-5'), at=now - timedelta(days=1))

        self.assertEqual(recalculate_min_stock(), 1)

        stock = IngredientStock.objects.get(ingredient=self.flour)
        self.assertEqual(stock.min_stock_level, Decimal('42.5'))
        self.assertEqual(warehouse_row(self.flour)['daily_usage'], str((Decimal('42.5') / 7).quantize(Decimal('0.001'))))

    def test_minimum_drops_to_zero_without_recent_production(self):
        record_movement(self.flour.pk, StockMovement.KIND_PRODUCTION, Decimal('-40'), at=timezone.now() - timedelta(days=9))

        recalculate_min_stock()

        self.assertEqual(IngredientStock.objects.get(ingredient=self.flour).min_stock_level, Decimal('0'))

    def test_history_ends_at_current_stock(self):
        record_movement(self.flour.pk, StockMovement.KIND_DELIVERY, Decimal('30'))
        self.api.force_authenticate(self.admin)

        data = self.api.get(f'/api/products/ingredients/{self.flour.pk}/history/?days=7').data

        self.assertEqual(len(data['series']), 7)
        self.assertEqual(Decimal(data['series'][0]['balance']), Decimal('100'))
        self.assertEqual(Decimal(data['series'][-1]['balance']), Decimal('130'))
        self.assertEqual(Decimal(data['series'][-1]['received']), Decimal('30'))
        self.assertEqual(data['movements'][0]['kind'], 'delivery')
