from decimal import Decimal

from django.utils import timezone

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

CLIENT_LOCATIONS = [
    (1, 'Rynek 1, Skoczów', '49.800285', '18.787902'),
    (1, 'Mickiewicza 5, Skoczów', '49.800221', '18.786579'),
    (1, 'Cieszyńska 25, Skoczów', '49.798622', '18.781996'),
    (1, 'Bielska 10, Skoczów', '49.801379', '18.788735'),
    (1, 'Górecka 15, Skoczów', '49.801234', '18.796206'),
    (1, 'Krzywa 2, Skoczów', '49.793828', '18.794177'),
    (1, 'Objazdowa 4, Skoczów', '49.803204', '18.789153'),
    (2, 'Rynek 3, Ustroń', '49.718741', '18.811664'),
    (2, 'Daszyńskiego 20, Ustroń', '49.721240', '18.809504'),
    (2, '3 Maja 40, Ustroń', '49.712970', '18.817985'),
    (2, 'Grażyńskiego 20, Ustroń', '49.720102', '18.812736'),
    (2, 'Plac Hoffa 3, Wisła', '49.655225', '18.860155'),
    (2, '1 Maja 20, Wisła', '49.643161', '18.872835'),
    (2, 'Wyzwolenia 10, Wisła', '49.633997', '18.893824'),
    (3, 'Rynek 10, Cieszyn', '49.749253', '18.633087'),
    (3, 'Głęboka 15, Cieszyn', '49.748808', '18.631067'),
    (3, 'Bobrecka 20, Cieszyn', '49.748660', '18.636305'),
    (3, 'Frysztacka 50, Cieszyn', '49.757393', '18.623949'),
    (3, 'Stawowa 5, Cieszyn', '49.752590', '18.641200'),
    (3, 'Korfantego 10, Cieszyn', '49.749439', '18.638627'),
    (3, 'Cieszyńska 15, Goleszów', '49.733335', '18.738470'),
    (4, 'Rynek 20, Bielsko-Biała', '49.821371', '19.043368'),
    (4, '11 Listopada 30, Bielsko-Biała', '49.822849', '19.050251'),
    (4, 'Cieszyńska 50, Bielsko-Biała', '49.818753', '19.036060'),
    (4, 'Piastowska 20, Bielsko-Biała', '49.827779', '19.037946'),
    (4, 'Sobieskiego 50, Bielsko-Biała', '49.820265', '19.035077'),
    (4, 'Komorowicka 30, Bielsko-Biała', '49.853854', '19.039907'),
    (4, 'Partyzantów 20, Bielsko-Biała', '49.817130', '19.043398'),
    (5, 'Rynek 5, Strumień', '49.917213', '18.762729'),
    (5, 'Wiślańska 10, Zbytków', '49.911675', '18.735865'),
    (5, 'Główna 20, Drogomyśl', '49.869094', '18.756937'),
    (5, 'Bielska 20, Chybie', '49.889847', '18.829995'),
    (5, 'Główna 10, Pruchna', '49.864885', '18.683509'),
    (5, 'Dworcowa 5, Zebrzydowice', '49.869602', '18.623429'),
    (6, 'Wyzwolenia 50, Brenna', '49.722614', '18.912188'),
    (6, 'Szkolna 5, Brenna', '49.718324', '18.937591'),
    (6, 'Harcerska 5, Górki Wielkie', '49.781554', '18.854775'),
    (6, 'Zdrojowa 10, Jaworze', '49.793528', '18.947813'),
    (6, 'Słoneczna 5, Jaworze', '49.793109', '18.944460'),
    (6, 'Bielska 30, Międzyrzecze Górne', '49.830650', '18.962849'),
]

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
    for i, (route_number, address, latitude, longitude) in enumerate(CLIENT_LOCATIONS):
        name = CLIENT_TYPES[i % len(CLIENT_TYPES)].format(CLIENT_BRAND_NAMES[i])
        client, _ = Client.objects.get_or_create(
            name=name,
            defaults={
                'address': address,
                'phone': f'+48{600100200 + i * 1117}',
                'route': routes[(route_number - 1) % len(routes)],
                'is_active': i not in INACTIVE_CLIENT_INDICES,
                'latitude': Decimal(latitude),
                'longitude': Decimal(longitude),
                'geocoded_at': timezone.now(),
            },
        )
        clients.append(client)
    return clients
