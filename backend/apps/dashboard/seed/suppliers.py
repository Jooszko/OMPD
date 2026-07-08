from datetime import datetime, timedelta
from decimal import Decimal

from django.utils import timezone

from finance.models import Supplier, SupplierIngredient, SupplyOrder, SupplyOrderItem

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

SUPPLY_ORDER_STATUSES = ['ordered', 'partially_received', 'completed', 'cancelled']
SUPPLY_ORDER_COUNT = 25


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


def create_supply_orders(suppliers, supplier_links, admin_user, date_range):
    supplier_list = list(suppliers.values())
    orders = []
    for i in range(SUPPLY_ORDER_COUNT):
        day_offset = i % len(date_range)
        order_date = date_range[day_offset]
        supplier = supplier_list[i % len(supplier_list)]
        status = SUPPLY_ORDER_STATUSES[i % len(SUPPLY_ORDER_STATUSES)]
        order_datetime = timezone.make_aware(datetime.combine(order_date, datetime.min.time()))
        expected_datetime = order_datetime + timedelta(days=3)

        order, created = SupplyOrder.objects.get_or_create(
            supplier=supplier,
            order_date=order_datetime,
            defaults={
                'expected_delivery_date': expected_datetime,
                'status': status,
                'created_by': admin_user,
            },
        )
        if created:
            supplier_link_subset = [
                link for link in supplier_links if link.supplier_id == supplier.supplier_id
            ]
            if supplier_link_subset:
                item_count = 1 + (i % min(3, len(supplier_link_subset)))
                for offset in range(item_count):
                    link = supplier_link_subset[offset % len(supplier_link_subset)]
                    quantity = Decimal(10 + ((i + offset) % 90))
                    received = quantity if status == 'completed' else Decimal('0.000')
                    SupplyOrderItem.objects.get_or_create(
                        supply_order=order,
                        ingredient=link.ingredient,
                        defaults={
                            'quantity_ordered': quantity,
                            'quantity_received': received,
                            'unit_price': link.last_price or Decimal('5.00'),
                        },
                    )
        orders.append(order)
    return orders
