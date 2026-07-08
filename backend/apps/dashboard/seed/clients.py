from clients.models import Client, Route

CLIENT_TYPES = [
    'Sklep Spożywczy "{}"',
    'Piekarnia "{}"',
    'Restauracja "{}"',
    'Kawiarnia "{}"',
    'Stołówka {}',
    'Hotel "{}"',
    'Bar Mleczny "{}"',
    'Delikatesy "{}"',
    'Sklep Osiedlowy "{}"',
    'Cukiernia "{}"',
]

CLIENT_BRAND_NAMES = [
    'U Gosi', 'Pod Jelenie', 'Złoty Kłos', 'Nad Wisłą', 'Rodzinna',
    'Smakosz', 'Wesoła', 'Miodowa', 'Słoneczna', 'Zielona',
    'Pod Lipami', 'Stary Młyn', 'Nowa', 'Przystanek', 'Górska',
    'Leśna', 'Rynek', 'Centralna', 'Mała', 'Wielka',
    'Ratuszowa', 'Ogrodowa', 'Kwiatowa', 'Spokojna', 'Wiejska',
    'Miejska', 'Kolorowa', 'Jasna', 'Cicha', 'Radosna',
    'Pogodna', 'Malinowa', 'Wrzosowa', 'Bursztynowa', 'Piastowska',
    'Klonowa', 'Akacjowa', 'Brzozowa', 'Świerkowa', 'Sosnowa',
]

CLIENT_CITIES_STREETS = [
    ('Skoczów', 'Targowa 12'), ('Ustroń', 'Sportowa 3'), ('Cieszyn', 'Kwiatowa 7'),
    ('Brenna', 'Leśna 22'), ('Bielsko-Biała', 'Rynek 4'), ('Bielsko-Biała', 'Szeroka 5'),
    ('Wisła', 'Górna 9'), ('Goleszów', 'Cieszyńska 2'), ('Strumień', 'Bielska 18'),
    ('Chybie', 'Główna 6'),
]

CLIENT_COUNT = 40
INACTIVE_CLIENT_INDICES = {7, 19, 33}


def create_routes(drivers):
    routes = []
    for index, driver in enumerate(drivers):
        route, _ = Route.objects.get_or_create(
            route_name=f'Trasa {index + 1}',
            defaults={'driver': driver, 'is_active': True},
        )
        routes.append(route)
    return routes


def create_clients(routes):
    clients = []
    for i in range(CLIENT_COUNT):
        brand = CLIENT_BRAND_NAMES[i]
        template = CLIENT_TYPES[i % len(CLIENT_TYPES)]
        city, street = CLIENT_CITIES_STREETS[i % len(CLIENT_CITIES_STREETS)]
        name = template.format(brand)
        address = f'{street}, {city}'
        client, _ = Client.objects.get_or_create(
            name=name,
            defaults={
                'address': address,
                'route': routes[i % len(routes)],
                'is_active': i not in INACTIVE_CLIENT_INDICES,
            },
        )
        clients.append(client)
    return clients
