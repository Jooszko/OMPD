import re
from datetime import timedelta
from io import StringIO
from pathlib import Path

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import SimpleTestCase, TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from audit.labels import ACTION_LABELS
from audit.models import AuditEntry
from users.models import User

URL = '/api/audit/'


def make_entry(actor=None, days_ago=0, **fields):
    data = {'category': 'clients', 'action': 'client.updated', 'description': 'Zmieniono dane klienta.', **fields}
    entry = AuditEntry.objects.create(actor=actor, actor_name=actor.full_name if actor else '', **data)
    if days_ago:
        AuditEntry.objects.filter(pk=entry.pk).update(created_at=timezone.now() - timedelta(days=days_ago))
    return entry


class AuditListApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.admin = User.objects.create_user(username='admin_d7', password='x', role='admin', full_name='Anna Admin')
        self.baker = User.objects.create_user(username='baker_d7', password='x', role='baker', full_name='Piotr Piekarz')
        self.api.force_authenticate(self.admin)

    def ids(self, response):
        return [row['entry_id'] for row in response.data['results']]

    def test_only_admin_can_read_the_log(self):
        self.api.force_authenticate(self.baker)

        self.assertEqual(self.api.get(URL).status_code, 403)
        self.assertEqual(self.api.get(f'{URL}filters/').status_code, 403)

    def test_returns_newest_first_with_polish_labels(self):
        old = make_entry(self.admin, days_ago=2)
        new = make_entry(self.admin, category='finance', action='expense.created', description='Dodano wydatek.')

        response = self.api.get(URL)

        self.assertEqual(self.ids(response), [new.pk, old.pk])
        row = response.data['results'][0]
        self.assertEqual((row['category_label'], row['action_label']), ('Finanse', 'Nowy wydatek'))
        self.assertEqual(row['actor_name'], 'Anna Admin')

    def test_filters_by_category_actor_and_text(self):
        mine = make_entry(self.admin, object_label='Sklep Pod Lipą')
        make_entry(self.baker, object_label='Sklep Pod Lipą')
        make_entry(self.admin, category='finance', action='expense.created', object_label='Paliwo')

        response = self.api.get(URL, {'category': 'clients', 'actor': self.admin.pk, 'q': 'pod lip'})

        self.assertEqual(self.ids(response), [mine.pk])

    def test_filters_by_date_range(self):
        make_entry(self.admin, days_ago=10)
        recent = make_entry(self.admin, days_ago=3)
        make_entry(self.admin)
        today = timezone.localdate()

        response = self.api.get(URL, {
            'date_from': str(today - timedelta(days=5)),
            'date_to': str(today - timedelta(days=1)),
        })

        self.assertEqual(self.ids(response), [recent.pk])

    def test_shows_history_of_one_object(self):
        target = make_entry(self.admin, object_type='client', object_id='7')
        make_entry(self.admin, object_type='client', object_id='8')

        response = self.api.get(URL, {'object_type': 'client', 'object_id': '7'})

        self.assertEqual(self.ids(response), [target.pk])

    def test_paginates_results(self):
        for _ in range(3):
            make_entry(self.admin)

        response = self.api.get(URL, {'page_size': 2, 'page': 2})

        self.assertEqual(response.data['count'], 3)
        self.assertEqual(len(response.data['results']), 1)

    def test_rejects_invalid_filters(self):
        self.assertEqual(self.api.get(URL, {'date_from': '11.10.2026'}).status_code, 400)
        self.assertEqual(self.api.get(URL, {'category': 'weather'}).status_code, 400)
        self.assertEqual(self.api.get(URL, {'actor': 'anna'}).status_code, 400)
        self.assertEqual(self.api.get(URL, {'date_from': '2026-10-11', 'date_to': '2026-10-01'}).status_code, 400)

    def test_filter_options_list_categories_actions_and_actors(self):
        make_entry(self.baker)

        response = self.api.get(f'{URL}filters/')

        self.assertIn({'value': 'finance', 'label': 'Finanse'}, response.data['categories'])
        self.assertIn(
            {'value': 'expense.created', 'label': 'Nowy wydatek', 'category': 'finance'},
            response.data['actions'],
        )
        self.assertEqual(response.data['actors'], [{'id': self.baker.pk, 'name': 'Piotr Piekarz'}])

    def test_date_filter_uses_polish_days(self):
        late = make_entry(self.admin)
        AuditEntry.objects.filter(pk=late.pk).update(created_at=datetime(2026, 10, 11, 23, 30, tzinfo=UTC))

        next_day = self.api.get(URL, {'date_from': '2026-10-12', 'date_to': '2026-10-12'})
        same_day = self.api.get(URL, {'date_from': '2026-10-11', 'date_to': '2026-10-11'})

        self.assertEqual(self.ids(next_day), [late.pk])
        self.assertEqual(self.ids(same_day), [])

class ActionLabelsTests(SimpleTestCase):
    def test_every_action_used_in_views_has_a_label(self):
        apps_dir = Path(__file__).resolve().parents[2]
        used = set()
        for views_file in apps_dir.glob('*/views.py'):
            used |= set(re.findall(r"'([a-z_]+\.[a-z_]+)'", views_file.read_text(encoding='utf-8')))

        self.assertTrue(used)
        self.assertEqual(used - ACTION_LABELS.keys(), set())


class PruneAuditLogTests(TestCase):
    def setUp(self):
        self.old = make_entry(days_ago=400)
        self.recent = make_entry(days_ago=100)

    def run_command(self, *args):
        out = StringIO()
        call_command('prune_audit_log', *args, stdout=out)
        return out.getvalue()

    def test_deletes_only_entries_older_than_a_year(self):
        output = self.run_command()

        self.assertEqual(list(AuditEntry.objects.values_list('pk', flat=True)), [self.recent.pk])
        self.assertIn('Usunięto 1', output)

    def test_dry_run_deletes_nothing(self):
        output = self.run_command('--dry-run')

        self.assertEqual(AuditEntry.objects.count(), 2)
        self.assertIn('Do usunięcia: 1', output)

    def test_custom_retention(self):
        self.run_command('--days', '90')

        self.assertEqual(AuditEntry.objects.count(), 0)

    def test_refuses_too_short_retention(self):
        with self.assertRaises(CommandError):
            self.run_command('--days', '7')