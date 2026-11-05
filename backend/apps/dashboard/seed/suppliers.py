from decimal import Decimal

from finance.models import Supplier, SupplierIngredient
from products.models import IngredientStock

SUPPLIER_DATA = [
    ('Młyn „Złoty Kłos"', '123-456-789', 'biuro@zlotyklos.pl', 'Cieszyn, ul. Młyńska 5', True),
    ('Hurtownia Surowców „BakeryTrade"', '987-654-321', 'zamowienia@bakerytrade.pl', 'Bielsko-Biała, ul. Piekarska 10', True),
    ('Cukiernia Hurt „SłodkiPak"', '111-222-333', 'kontakt@slodkipak.pl', 'Katowice, ul. Cukrowa 8', True),
    ('Piekarnia Surowce „ZbożePlus"', '222-333-444', 'biuro@zboczeplus.pl', 'Kraków, ul. Zbożowa 15', True),
    ('Nabiał Podhalański Sp. z o.o.', '333-444-555', 'sprzedaz@nabialpodhalanski.pl', 'Nowy Targ, ul. Mleczna 3', True),
    ('Tłuszcze Roślinne "OleoTrade"', '444-555-666', 'biuro@oleotrade.pl', 'Wrocław, ul. Olejowa 7', True),
    ('Opakowania "PakBake"', '555-666-777', 'zamowienia@pakbake.pl', 'Gliwice, ul. Foliowa 2', True),
    ('Dodatki Piekarnicze "FermPlus"', '666-777-888', 'kontakt@fermplus.pl', 'Rybnik, ul. Drożdżowa 11', True),
    ('Transport Chłodniczy "ZimnyWóz"', '777-888-999', 'logistyka@zimnywoz.pl', 'Tychy, ul. Chłodna 4', False),
    ('Hurtownia Ogólnospożywcza "MegaHurt"', '888-999-000', 'biuro@megahurt.pl', 'Częstochowa, ul. Handlowa 20', True),
]

def create_suppliers():
    suppliers = {}
    for name, phone, email, address, is_active in SUPPLIER_DATA:
        supplier, _ = Supplier.objects.get_or_create(
            name=name,
            defaults={
                'phone': phone,
                'email': email,
                'address': address,
                'is_active': is_active,
            },
        )
        suppliers[name] = supplier
    return suppliers


MILL = 'Młyn „Złoty Kłos"'
DAIRY = 'Nabiał Podhalański Sp. z o.o.'
SWEET = 'Cukiernia Hurt „SłodkiPak"'
GRAIN = 'Piekarnia Surowce „ZbożePlus"'
OIL = 'Tłuszcze Roślinne "OleoTrade"'
FERM = 'Dodatki Piekarnicze "FermPlus"'
WHOLESALE = 'Hurtownia Ogólnospożywcza "MegaHurt"'

# (dostawca, cena hurtowa netto za jednostkę surowca) — ceny orientacyjne z 2026 r.
INGREDIENT_SUPPLY = {
    'Mąka pszenna typ 550': (MILL, Decimal('2.20')),
    'Mąka pszenna typ 750': (MILL, Decimal('2.40')),
    'Mąka pszenna graham typ 1850': (MILL, Decimal('3.40')),
    'Mąka żytnia typ 720': (MILL, Decimal('2.60')),
    'Mąka żytnia razowa typ 2000': (MILL, Decimal('3.10')),
    'Woda': (WHOLESALE, Decimal('0.02')),
    'Drożdże świeże': (FERM, Decimal('11.50')),
    'Sól': (WHOLESALE, Decimal('1.60')),
    'Cukier': (SWEET, Decimal('3.80')),
    'Cukier puder': (SWEET, Decimal('6.20')),
    'Masło': (DAIRY, Decimal('31.00')),
    'Olej rzepakowy': (OIL, Decimal('7.90')),
    'Jaja': (DAIRY, Decimal('0.85')),
    'Mleko': (DAIRY, Decimal('3.40')),
    'Ser żółty': (DAIRY, Decimal('29.00')),
    'Twaróg': (DAIRY, Decimal('17.50')),
    'Mak': (GRAIN, Decimal('22.00')),
    'Rodzynki': (SWEET, Decimal('16.00')),
    'Cynamon': (SWEET, Decimal('58.00')),
    'Ziarna słonecznika': (GRAIN, Decimal('8.50')),
    'Konfitura różana': (SWEET, Decimal('26.00')),
}


def create_supplier_ingredients(suppliers, ingredients):
    links = []
    for idx, (name, ingredient) in enumerate(ingredients.items()):
        supplier_name, price = INGREDIENT_SUPPLY[name]
        link, _ = SupplierIngredient.objects.get_or_create(
            supplier=suppliers[supplier_name],
            ingredient=ingredient,
            defaults={'supplier_part_no': f'SKU-{idx + 1:03d}', 'last_price': price},
        )
        IngredientStock.objects.filter(ingredient=ingredient).update(current_price=link.last_price)
        links.append(link)
    return links
