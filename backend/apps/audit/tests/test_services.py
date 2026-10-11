from datetime import date
from decimal import Decimal

from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory, TestCase

from audit.models import AuditEntry
from audit.services import field_changes, record_event, snapshot
from products.models import Product
from users.models import User


class RecordEventTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='anna_a', password='x', role='admin', full_name='Anna Nowak')
        self.product = Product.objects.create(name='Chleb żytni', category='bread', base_price=Decimal('4.50'))
        self.request = RequestFactory().post('/', REMOTE_ADDR='192.168.1.20')
        self.request.user = self.user

    def test_stores_actor_object_and_ip(self):
        entry = record_event(
            self.request, category='products', action='product.price_changed',
            description='Zmieniono cenę.', obj=self.product,
        )

        self.assertEqual(entry.actor, self.user)
        self.assertEqual(entry.actor_name, 'Anna Nowak')
        self.assertEqual((entry.object_type, entry.object_id), ('product', str(self.product.pk)))
        self.assertEqual(entry.object_label, str(self.product))
        self.assertEqual(entry.ip_address, '192.168.1.20')

    def test_anonymous_request_can_name_the_attempted_account(self):
        self.request.user = AnonymousUser()

        entry = record_event(
            self.request, category='accounts', action='login.failed',
            description='Nieudane logowanie.', actor_name='kowalski',
        )

        self.assertIsNone(entry.actor)
        self.assertEqual(entry.actor_name, 'kowalski')

    def test_entry_survives_deleting_the_actor(self):
        entry = record_event(self.request, category='accounts', action='x', description='Opis.')

        self.user.delete()
        entry.refresh_from_db()

        self.assertIsNone(entry.actor)
        self.assertEqual(entry.actor_name, 'Anna Nowak')

    def test_entries_cannot_be_modified(self):
        entry = record_event(self.request, category='accounts', action='x', description='Opis.')

        entry.description = 'Podmieniony opis.'
        with self.assertRaises(ValueError):
            entry.save()
        self.assertEqual(AuditEntry.objects.get().description, 'Opis.')


class FieldChangesTests(TestCase):
    def test_lists_only_changed_fields_with_labels_and_plain_values(self):
        product = Product(name='Chleb', category='bread', base_price=Decimal('4.50'))
        before = snapshot(product, ['name', 'base_price'])
        product.base_price = Decimal('4.80')

        changes = field_changes(before, snapshot(product, ['name', 'base_price']), {'name': 'Nazwa', 'base_price': 'Cena'})

        self.assertEqual(changes, [{'field': 'base_price', 'label': 'Cena', 'old': '4.50', 'new': '4.80'}])

    def test_dates_become_iso_text(self):
        class Holder:
            day = date(2026, 10, 11)

        self.assertEqual(snapshot(Holder(), ['day']), {'day': '2026-10-11'})