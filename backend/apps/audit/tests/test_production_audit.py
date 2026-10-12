from rest_framework.test import APIClient

from audit.models import AuditEntry
from production.models import Dough, Mixer, ProductionBatch
from production.services.lifecycle import start_stage
from production.tests.test_planning import PlanTestBase


def change_rows(entry):
    return [(c['label'], c['old'], c['new']) for c in entry.changes]


class ProductionAuditTests(PlanTestBase):
    def setUp(self):
        super().setUp()
        self.api = APIClient()

    def as_user(self, user):
        self.api.force_authenticate(user)
        return self.api

    def entries(self, action):
        return AuditEntry.objects.filter(category='production', action=action)

    def generate(self):
        return self.as_user(self.admin).post(
            '/api/production/plan/', {'delivery_date': str(self.delivery)}, format='json'
        )

    def batch_url(self, batch, action):
        return f'/api/production/batches/{batch.pk}/{action}/'

    # --- planowanie ---------------------------------------------------------

    def test_generating_plan_is_logged_with_quantities(self):
        self.order(self.bread_500, 40)

        self.assertEqual(self.generate().status_code, 201)

        entry = self.entries('plan.generated').get()
        self.assertEqual(entry.actor, self.admin)
        self.assertEqual(entry.object_type, 'productionplan')
        self.assertEqual(entry.object_label, 'Plan na dostawę 13.10.2026')
        self.assertIn('1 ciasto, 1 dzieża, 22.44 kg ciasta', entry.description)
        self.assertEqual(
            change_rows(entry), [('Liczba dzieży', None, 1), ('Chleb wiejski 500g [szt.]', None, 40)]
        )

    def test_recalculating_plan_logs_what_changed(self):
        self.order(self.bread_500, 40)
        self.generate()
        self.order(self.bread_500, 15, client=self.shop_b)

        self.generate()

        entry = self.entries('plan.regenerated').get()
        self.assertTrue(entry.description.startswith('Przeliczono plan produkcji'))
        self.assertEqual(change_rows(entry), [('Chleb wiejski 500g [szt.]', 40, 55)])

    def test_refused_recalculation_leaves_no_entry(self):
        self.order(self.bread_500, 40)
        self.generate()
        ProductionBatch.objects.update(stage='dividing')

        self.assertEqual(self.generate().status_code, 409)

        self.assertFalse(self.entries('plan.regenerated').exists())

    # --- tablica produkcji --------------------------------------------------

    def started_batch(self):
        self.order(self.bread_500, 40)
        self.generate()
        batch = ProductionBatch.objects.get()
        start_stage(batch.pk, self.baker, expected_stage='mixing')
        return batch

    def test_finishing_mixing_logs_who_started_and_ingredients_taken(self):
        batch = self.started_batch()

        response = self.as_user(self.admin).post(self.batch_url(batch, 'advance'), {'stage': 'mixing'}, format='json')

        self.assertEqual(response.status_code, 200)
        entry = self.entries('batch.stage_completed').get()
        self.assertEqual(entry.object_type, 'productionbatch')
        self.assertEqual(entry.object_label, 'Ciasto wiejskie #1/1, dostawa 13.10.2026')
        self.assertIn('Zakończono etap „Mieszanie”', entry.description)
        self.assertIn('Etap rozpoczął(a): Jan Piekarz.', entry.description)
        self.assertIn('Pobrano z magazynu: ', entry.description)
        self.assertIn('Mąka 750 13.464 kg', entry.description)
        self.assertEqual(change_rows(entry), [('Etap', 'Mieszanie', 'Dzielenie / formowanie')])

    def test_finishing_last_stage_logs_goods_received(self):
        batch = self.started_batch()
        api = self.as_user(self.baker)
        for stage in ['mixing', 'dividing', 'proofing', 'baking']:
            if stage != 'mixing':
                api.post(self.batch_url(batch, 'start'), {'stage': stage}, format='json')
            api.post(self.batch_url(batch, 'advance'), {'stage': stage}, format='json')

        entries = self.entries('batch.stage_completed')
        self.assertEqual(entries.count(), 4)
        last = entries.order_by('-entry_id').first()
        self.assertIn('Przyjęto na magazyn: Chleb wiejski 500g 40 szt.', last.description)
        self.assertNotIn('rozpoczął', last.description)  # ten sam piekarz rozpoczął i zakończył

    def test_stale_action_leaves_no_entry(self):
        batch = self.started_batch()

        response = self.as_user(self.baker).post(self.batch_url(batch, 'advance'), {'stage': 'baking'}, format='json')

        self.assertEqual(response.status_code, 409)
        self.assertFalse(self.entries('batch.stage_completed').exists())

    def test_waste_is_logged_with_shortfall(self):
        batch = self.started_batch()

        self.as_user(self.baker).post(
            self.batch_url(batch, 'waste'),
            {'product_id': self.bread_500.pk, 'quantity': 3, 'reason': 'burnt'},
            format='json',
        )

        entry = self.entries('batch.waste_recorded').get()
        self.assertEqual(entry.actor, self.baker)
        self.assertEqual(
            entry.description,
            'Zgłoszono stratę 3 szt. Chleb wiejski 500g (przypalone) na etapie „Mieszanie” dzieży '
            'Ciasto wiejskie #1. Zamówienia niepokryte — brakuje 3 szt.',
        )

    # --- ustawienia produkcji -----------------------------------------------

    def test_mixer_created_and_updated(self):
        api = self.as_user(self.admin)
        created = api.post(
            '/api/production/mixers/', {'name': 'Mała', 'min_capacity_kg': '5', 'max_capacity_kg': '40'}, format='json'
        )
        url = f"/api/production/mixers/{created.data['mixer_id']}/"

        api.patch(url, {'is_active': False}, format='json')
        api.patch(url, {'is_active': False}, format='json')  # bez zmian — bez wpisu

        self.assertEqual(self.entries('mixer.created').get().description, 'Dodano mieszałkę Mała.')
        updated = self.entries('mixer.updated').get()
        self.assertEqual(change_rows(updated), [('Sprawna', True, False)])

    def test_dough_recipe_change_is_logged_per_ingredient(self):
        self.as_user(self.admin).patch(
            f'/api/production/doughs/{self.dough.pk}/',
            {'mixer_id': self.mixer.pk, 'ingredients': [{'ingredient_id': self.flour.pk, 'amount_per_kg': '0.65'}]},
            format='json',
        )

        entry = self.entries('dough.updated').get()
        self.assertEqual(
            change_rows(entry),
            [
                ('Domyślna mieszałka', 'dobierana automatycznie', 'Spiralna 120'),
                ('Receptura: Mąka 750', '0.6 kg/kg', '0.65 kg/kg'),
                ('Receptura: Woda', '0.4 l/kg', None),
            ],
        )

    def test_dough_deletion_is_logged_only_when_it_succeeds(self):
        api = self.as_user(self.admin)
        unused = Dough.objects.create(name='Nieużywane')

        self.assertEqual(api.delete(f'/api/production/doughs/{self.dough.pk}/').status_code, 409)
        self.assertEqual(api.delete(f'/api/production/doughs/{unused.pk}/').status_code, 204)

        entry = self.entries('dough.deleted').get()
        self.assertEqual(entry.object_id, str(unused.pk))
        self.assertEqual(entry.object_label, 'Nieużywane')

    def test_bake_spec_events_are_attached_to_the_product(self):
        api = self.as_user(self.admin)
        url = f'/api/production/bake-specs/{self.cake.pk}/'
        payload = {'dough_id': self.dough.pk, 'piece_weight_kg': '0.250', 'bake_temp_c': 180, 'bake_time_min': 40}

        api.put(url, payload, format='json')
        api.put(url, {**payload, 'piece_weight_kg': '0.300'}, format='json')
        api.delete(url)

        entries = list(AuditEntry.objects.filter(object_type='product', object_id=str(self.cake.pk)).order_by('entry_id'))
        self.assertEqual([e.action for e in entries], ['bake_spec.updated', 'bake_spec.updated', 'bake_spec.deleted'])
        self.assertIn('Przypisano wyrób Sernik do ciasta Ciasto wiejskie', entries[0].description)
        self.assertEqual(change_rows(entries[1]), [('Waga kęsa [kg]', '0.25', '0.3')])

    def test_rejected_settings_change_leaves_no_entry(self):
        self.as_user(self.admin).post(
            '/api/production/mixers/', {'name': 'Zła', 'min_capacity_kg': '50', 'max_capacity_kg': '40'}
        )

        self.assertFalse(AuditEntry.objects.filter(category='production').exists())
        self.assertFalse(Mixer.objects.filter(name='Zła').exists())

    def test_production_category_is_offered_in_audit_filters(self):
        response = self.as_user(self.admin).get('/api/audit/filters/')

        self.assertIn({'value': 'production', 'label': 'Produkcja'}, response.data['categories'])
        actions = {a['value'] for a in response.data['actions'] if a['category'] == 'production'}
        self.assertIn('batch.waste_recorded', actions)
