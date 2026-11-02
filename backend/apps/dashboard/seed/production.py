from decimal import Decimal

from production.models import Dough, DoughIngredient, Mixer, ProductBakeSpec

MIXER_DATA = [
    # (name, min_capacity_kg, max_capacity_kg)
    ('Mieszałka spiralna duża', Decimal('20.000'), Decimal('120.000')),
    ('Mieszałka spiralna mała', Decimal('5.000'), Decimal('40.000')),
]

DOUGH_DATA = [
    # (name, mixer_name, loss_buffer_pct, mixing_time_min, target_temp_c, proofing_time_min, instructions, [(ingredient_name, amount_per_kg_of_dough), ...])
    ('Ciasto pszenne', 'Mieszałka spiralna duża', Decimal('3.00'), 12, Decimal('26.0'), 50,
     'Mąka i woda 4 min na wolnych obrotach, dodać drożdże i sól, 8 min na szybkich.', [
         ('Mąka pszenna typ 550', Decimal('0.6110')),
         ('Woda', Decimal('0.3670')),
         ('Drożdże świeże', Decimal('0.0120')),
         ('Sól', Decimal('0.0100')),
     ]),
    ('Ciasto wiejskie', 'Mieszałka spiralna duża', Decimal('3.00'), 10, Decimal('27.0'), 60,
     'Mąki z wodą 5 min wolno, autoliza 15 min, następnie drożdże i sól, 5 min szybko.', [
         ('Mąka pszenna typ 750', Decimal('0.4880')),
         ('Mąka żytnia typ 720', Decimal('0.1460')),
         ('Woda', Decimal('0.3420')),
         ('Drożdże świeże', Decimal('0.0120')),
         ('Sól', Decimal('0.0120')),
     ]),
    ('Ciasto razowe', 'Mieszałka spiralna duża', Decimal('4.00'), 8, Decimal('28.0'), 70,
     'Mieszać tylko na wolnych obrotach, ciasto ma pozostać lepkie.', [
         ('Mąka żytnia typ 720', Decimal('0.5100')),
         ('Mąka pszenna typ 550', Decimal('0.1280')),
         ('Woda', Decimal('0.3500')),
         ('Drożdże świeże', Decimal('0.0100')),
         ('Sól', Decimal('0.0100')),
     ]),
    ('Ciasto drożdżowe słodkie', 'Mieszałka spiralna mała', Decimal('2.50'), 14, Decimal('25.0'), 40,
     'Masło dodać pod koniec mieszania, ciasto gładkie i elastyczne.', [
         ('Mąka pszenna typ 550', Decimal('0.5800')),
         ('Mleko', Decimal('0.2700')),
         ('Cukier', Decimal('0.0600')),
         ('Masło', Decimal('0.0700')),
         ('Drożdże świeże', Decimal('0.0200')),
     ]),
]

BAKE_SPEC_DATA = [
    # (product_name, dough_name, piece_weight_kg, bake_temp_c, bake_time_min)
    ('Chleb pszenny 500g', 'Ciasto pszenne', Decimal('0.580'), 230, 35),
    ('Bagietka francuska', 'Ciasto pszenne', Decimal('0.300'), 250, 22),
    ('Bułka pszenna', 'Ciasto pszenne', Decimal('0.090'), 240, 14),
    ('Chleb wiejski 750g', 'Ciasto wiejskie', Decimal('0.860'), 230, 45),
    ('Chleb razowy 500g', 'Ciasto razowe', Decimal('0.600'), 220, 50),
    ('Bułka mleczna', 'Ciasto drożdżowe słodkie', Decimal('0.080'), 200, 15),
    ('Drożdżówka z serem', 'Ciasto drożdżowe słodkie', Decimal('0.100'), 190, 18),
    ('Drożdżówka z makiem', 'Ciasto drożdżowe słodkie', Decimal('0.100'), 190, 18),
    ('Chałka z rodzynkami', 'Ciasto drożdżowe słodkie', Decimal('0.400'), 180, 30),
]


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
    for product_name, dough_name, weight, temp, minutes in BAKE_SPEC_DATA:
        spec, _ = ProductBakeSpec.objects.get_or_create(
            product=products[product_name],
            defaults={'dough': doughs[dough_name], 'piece_weight_kg': weight, 'bake_temp_c': temp, 'bake_time_min': minutes},
        )
        specs.append(spec)
    return mixers, doughs, specs
