from decimal import Decimal

from finance.models import Supplier, SupplierIngredient

SUPPLIER_DATA = [
    # (name, phone, email, address, is_active)
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


def create_supplier_ingredients(suppliers, ingredients):
    supplier_list = list(suppliers.values())
    ingredient_list = list(ingredients.values())
    links = []
    for idx, ingredient in enumerate(ingredient_list):
        supplier = supplier_list[idx % len(supplier_list)]
        part_no = f'SKU-{idx + 1:03d}'
        price = (Decimal('2.00') + (Decimal(idx % 14) * Decimal('0.95'))).quantize(Decimal('0.01'))
        link, _ = SupplierIngredient.objects.get_or_create(
            supplier=supplier,
            ingredient=ingredient,
            defaults={'supplier_part_no': part_no, 'last_price': price},
        )
        links.append(link)
    return links
