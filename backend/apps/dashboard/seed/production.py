from decimal import Decimal

from common.losses import LOSS_BUFFER_PCT
from production.models import Dough, DoughIngredient, Mixer, ProductBakeSpec
from production.services.recipes import compose
from products.models import ProductAddition

MIXER_DATA = [
    # (name, min_capacity_kg, max_capacity_kg)
    ('Mieszałka spiralna duża', Decimal('20.000'), Decimal('120.000')),
    ('Mieszałka spiralna mała', Decimal('5.000'), Decimal('40.000')),
]

# Receptury liczone z procentów piekarskich (mąka = 100 %) na 1 kg gotowego ciasta.
# Woda i mleko w litrach (1 l ≈ 1 kg), jaja w sztukach (ok. 50 g bez skorupki).
DOUGH_DATA = [
    # (name, mixer_name, loss_buffer_pct, mixing_time_min, target_temp_c, proofing_time_min, instructions, [(ingredient_name, amount_per_kg_of_dough), ...])
    ('Ciasto pszenne', 'Mieszałka spiralna duża', LOSS_BUFFER_PCT, 12, Decimal('26.0'), 50,
     'Mąka i woda 4 min na wolnych obrotach, dodać drożdże, sól na 2 min przed końcem, 8 min na szybkich.', [
         ('Mąka pszenna typ 550', Decimal('0.6013')),
         ('Woda', Decimal('0.3728')),
         ('Drożdże świeże', Decimal('0.0150')),
         ('Sól', Decimal('0.0108')),
     ]),
    ('Ciasto pszenno-żytnie', 'Mieszałka spiralna duża', LOSS_BUFFER_PCT, 10, Decimal('27.0'), 60,
     'Mąki z wodą 5 min wolno, autoliza 15 min, następnie drożdże i sól, 5 min szybko.', [
         ('Mąka pszenna typ 750', Decimal('0.4706')),
         ('Mąka żytnia typ 720', Decimal('0.1176')),
         ('Woda', Decimal('0.3882')),
         ('Drożdże świeże', Decimal('0.0118')),
         ('Sól', Decimal('0.0118')),
     ]),
    ('Ciasto żytnie na zakwasie', 'Mieszałka spiralna mała', LOSS_BUFFER_PCT, 8, Decimal('29.0'), 90,
     'Zakwas z 40 % mąki żytniej i równej ilości wody nastawić 16 h wcześniej. '
     'Mieszać tylko na wolnych obrotach, bez drożdży, ciasto ma pozostać lepkie.', [
         ('Mąka żytnia typ 720', Decimal('0.4023')),
         ('Mąka pszenna typ 750', Decimal('0.1724')),
         ('Woda', Decimal('0.4138')),
         ('Sól', Decimal('0.0115')),
     ]),
    ('Ciasto żytnie razowe', 'Mieszałka spiralna mała', LOSS_BUFFER_PCT, 8, Decimal('29.0'), 60,
     'Zakwas z połowy mąki razowej nastawić 16 h wcześniej. Mieszać wolno, '
     'odrobina drożdży tylko dla pewności garu. Kłaść do form.', [
         ('Mąka żytnia razowa typ 2000', Decimal('0.4372')),
         ('Mąka żytnia typ 720', Decimal('0.1093')),
         ('Woda', Decimal('0.4372')),
         ('Drożdże świeże', Decimal('0.0055')),
         ('Sól', Decimal('0.0109')),
     ]),
    ('Ciasto graham', 'Mieszałka spiralna mała', LOSS_BUFFER_PCT, 10, Decimal('27.0'), 45,
     'Mąka graham chłonie więcej wody — mieszać 4 min wolno, 6 min szybko, odpoczynek 10 min przed dzieleniem.', [
         ('Mąka pszenna graham typ 1850', Decimal('0.5821')),
         ('Woda', Decimal('0.3842')),
         ('Drożdże świeże', Decimal('0.0175')),
         ('Sól', Decimal('0.0105')),
         ('Cukier', Decimal('0.0058')),
     ]),
    ('Ciasto słonecznikowe', 'Mieszałka spiralna mała', LOSS_BUFFER_PCT, 11, Decimal('26.0'), 55,
     'Słonecznik namoczyć 30 min wcześniej i dodać w ostatniej minucie na wolnych obrotach.', [
         ('Mąka pszenna typ 550', Decimal('0.4632')),
         ('Mąka żytnia typ 720', Decimal('0.0817')),
         ('Woda', Decimal('0.3488')),
         ('Ziarna słonecznika', Decimal('0.0817')),
         ('Drożdże świeże', Decimal('0.0136')),
         ('Sól', Decimal('0.0109')),
     ]),
    ('Ciasto maślane', 'Mieszałka spiralna mała', LOSS_BUFFER_PCT, 12, Decimal('26.0'), 45,
     'Mąka, mleko, jaja i drożdże 4 min wolno, cukier i sól, masło na ostatnie 3 min.', [
         ('Mąka pszenna typ 550', Decimal('0.5450')),
         ('Mleko', Decimal('0.2997')),
         ('Masło', Decimal('0.0545')),
         ('Cukier', Decimal('0.0436')),
         ('Jaja', Decimal('0.5450')),
         ('Drożdże świeże', Decimal('0.0218')),
         ('Sól', Decimal('0.0082')),
     ]),
    ('Ciasto chałkowe', 'Mieszałka spiralna mała', LOSS_BUFFER_PCT, 14, Decimal('25.0'), 60,
     'Masło dodać pod koniec, rodzynki (sparzone) w ostatniej minucie na wolnych obrotach. Pleść z 3–4 wałków.', [
         ('Mąka pszenna typ 550', Decimal('0.4995')),
         ('Mleko', Decimal('0.1998')),
         ('Jaja', Decimal('1.4985')),
         ('Rodzynki', Decimal('0.0749')),
         ('Cukier', Decimal('0.0599')),
         ('Masło', Decimal('0.0599')),
         ('Drożdże świeże', Decimal('0.0250')),
         ('Sól', Decimal('0.0060')),
     ]),
    ('Ciasto drożdżowe słodkie', 'Mieszałka spiralna mała', LOSS_BUFFER_PCT, 14, Decimal('25.0'), 50,
     'Masło dodać pod koniec mieszania, ciasto gładkie i elastyczne. Nadzienie nakładać po dzieleniu.', [
         ('Mąka pszenna typ 550', Decimal('0.5076')),
         ('Mleko', Decimal('0.2284')),
         ('Jaja', Decimal('1.5228')),
         ('Cukier', Decimal('0.0761')),
         ('Masło', Decimal('0.0761')),
         ('Drożdże świeże', Decimal('0.0305')),
         ('Sól', Decimal('0.0051')),
     ]),
    ('Ciasto pączkowe', 'Mieszałka spiralna mała', LOSS_BUFFER_PCT, 15, Decimal('27.0'), 40,
     'Ciasto bogate w żółtka, mieszać do odklejania się od dzieży. Po garze smażyć w oleju w 175 °C, '
     'po 3–4 min z każdej strony, nadziewać po ostudzeniu.', [
         ('Mąka pszenna typ 550', Decimal('0.5208')),
         ('Mleko', Decimal('0.2083')),
         ('Jaja', Decimal('2.0833')),
         ('Cukier', Decimal('0.0625')),
         ('Masło', Decimal('0.0625')),
         ('Drożdże świeże', Decimal('0.0365')),
         ('Sól', Decimal('0.0052')),
     ]),
]

BAKE_SPEC_DATA = [
    # (product_name, dough_name, piece_weight_kg, bake_temp_c, bake_time_min, [(ingredient_name, amount_per_piece), ...])
    # Lista na końcu to dodatki spoza ciasta: nadzienia, posypki, smarowanie, olej do smażenia.
    ('Chleb pszenny 500g', 'Ciasto pszenne', Decimal('0.580'), 230, 35, []),
    ('Bagietka francuska', 'Ciasto pszenne', Decimal('0.290'), 250, 22, []),
    ('Bułka pszenna', 'Ciasto pszenne', Decimal('0.065'), 240, 14, []),
    ('Bułka z serem', 'Ciasto pszenne', Decimal('0.080'), 220, 15, [('Ser żółty', Decimal('0.020'))]),
    ('Chleb wiejski 750g', 'Ciasto pszenno-żytnie', Decimal('0.860'), 230, 45, []),
    ('Chleb na zakwasie', 'Ciasto żytnie na zakwasie', Decimal('0.900'), 230, 55, []),
    ('Chleb razowy 500g', 'Ciasto żytnie razowe', Decimal('0.600'), 220, 55, []),
    ('Bułka grahamka', 'Ciasto graham', Decimal('0.075'), 230, 16, []),
    ('Chleb słonecznikowy', 'Ciasto słonecznikowe', Decimal('0.600'), 225, 40, [('Ziarna słonecznika', Decimal('0.010'))]),
    ('Bułka mleczna', 'Ciasto maślane', Decimal('0.070'), 200, 14, [('Jaja', Decimal('0.050'))]),
    ('Rogal maślany', 'Ciasto maślane', Decimal('0.090'), 200, 15, [('Masło', Decimal('0.006')), ('Jaja', Decimal('0.050'))]),
    ('Chałka z rodzynkami', 'Ciasto chałkowe', Decimal('0.450'), 180, 30, [
        ('Jaja', Decimal('0.100')), ('Masło', Decimal('0.005')), ('Cukier', Decimal('0.005')),
        ('Mąka pszenna typ 550', Decimal('0.006')),
    ]),
    ('Drożdżówka z serem', 'Ciasto drożdżowe słodkie', Decimal('0.070'), 190, 16, [
        ('Twaróg', Decimal('0.035')), ('Cukier', Decimal('0.006')), ('Jaja', Decimal('0.100')),
    ]),
    ('Drożdżówka z makiem', 'Ciasto drożdżowe słodkie', Decimal('0.070'), 190, 16, [
        ('Mak', Decimal('0.020')), ('Cukier', Decimal('0.008')), ('Masło', Decimal('0.003')), ('Jaja', Decimal('0.050')),
    ]),
    ('Drożdżówka cynamonowa', 'Ciasto drożdżowe słodkie', Decimal('0.080'), 190, 15, [
        ('Masło', Decimal('0.006')), ('Cukier', Decimal('0.008')), ('Cynamon', Decimal('0.001')),
    ]),
    ('Pączek z nadzieniem różanym', 'Ciasto pączkowe', Decimal('0.060'), 175, 8, [
        ('Konfitura różana', Decimal('0.018')), ('Olej rzepakowy', Decimal('0.009')), ('Cukier puder', Decimal('0.004')),
    ]),
]

def product_recipe(product_name):
    """Receptura jednej sztuki: kęs ciasta przeliczony na surowce plus dodatki.

    Bez bufora strat — doliczają go finanse (LOSS_BUFFER), więc receptura to czysty skład wyrobu.
    """
    _, dough_name, weight, _, _, extras = next(spec for spec in BAKE_SPEC_DATA if spec[0] == product_name)
    *_, dough_recipe = next(dough for dough in DOUGH_DATA if dough[0] == dough_name)
    # Ten sam wzór co w aplikacji (production.services.recipes), tylko po nazwach surowców.
    return compose({name: per_kg * weight for name, per_kg in dough_recipe}, dict(extras))


def create_production_setup(ingredients, products):
    mixers = {}
    for name, min_kg, max_kg in MIXER_DATA:
        mixers[name], _ = Mixer.objects.get_or_create(
            name=name, defaults={'min_capacity_kg': min_kg, 'max_capacity_kg': max_kg}
        )

    doughs = {}
    for name, mixer_name, loss, mixing, temp, proofing, instructions, recipe in DOUGH_DATA:
        dough, _ = Dough.objects.get_or_create(
            name=name,
            defaults={
                'mixer': mixers[mixer_name],
                'loss_buffer_pct': loss,
                'mixing_time_min': mixing,
                'target_dough_temp_c': temp,
                'proofing_time_min': proofing,
                'mixing_instructions': instructions,
            },
        )
        for ingredient_name, amount in recipe:
            DoughIngredient.objects.get_or_create(
                dough=dough, ingredient=ingredients[ingredient_name], defaults={'amount_per_kg': amount}
            )
        doughs[name] = dough

    specs = []
    for product_name, dough_name, weight, temp, minutes, extras in BAKE_SPEC_DATA:
        product = products[product_name]
        spec, _ = ProductBakeSpec.objects.get_or_create(
            product=product,
            defaults={'dough': doughs[dough_name], 'piece_weight_kg': weight, 'bake_temp_c': temp, 'bake_time_min': minutes},
        )
        for ingredient_name, amount in extras:
            ProductAddition.objects.get_or_create(
                product=product, ingredient=ingredients[ingredient_name], defaults={'amount': amount}
            )
        specs.append(spec)
    return mixers, doughs, specs
