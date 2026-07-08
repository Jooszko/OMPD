from users.models import Notification, User

SEED_PASSWORD = 'bakery2026'

USER_DATA = [
    # (username, full_name, role, email, is_active)
    ('mklukowski', 'Mikołaj Klukowski', 'admin', 'mklukowski@bakery.pl', True),
    ('kwisniewska', 'Karolina Wiśniewska', 'admin', 'kwisniewska@bakery.pl', True),
    ('anowak', 'Arkadiusz Nowak', 'baker', 'anowak@bakery.pl', True),
    ('kowalski_test', 'Tomasz Kowalski', 'baker', 'tkowalski@bakery.pl', False),
    ('pzielinski', 'Piotr Zieliński', 'baker', 'pzielinski@bakery.pl', True),
    ('klewandowska', 'Katarzyna Lewandowska', 'baker', 'klewandowska@bakery.pl', True),
    ('mkaczmarek', 'Marek Kaczmarek', 'baker', 'mkaczmarek@bakery.pl', True),
    ('jszymanska', 'Joanna Szymańska', 'baker', 'jszymanska@bakery.pl', True),
    ('gwozniak', 'Grzegorz Woźniak', 'baker', 'gwozniak@bakery.pl', True),
    ('mdabrowska', 'Magdalena Dąbrowska', 'baker', 'mdabrowska@bakery.pl', True),
    ('pkozlowski', 'Paweł Kozłowski', 'baker', 'pkozlowski@bakery.pl', True),
    ('ejankowska', 'Ewa Jankowska', 'baker', 'ejankowska@bakery.pl', True),
    ('kmazur', 'Krzysztof Mazur', 'baker', 'kmazur@bakery.pl', True),
    ('akrawczyk', 'Aneta Krawczyk', 'baker', 'akrawczyk@bakery.pl', True),
    ('jkrasinski', 'Jan Krasiński', 'driver', 'jkrasinski@bakery.pl', True),
    ('jnowak', 'Jan Nowak', 'driver', 'jnowak@bakery.pl', True),
    ('rwisniewski', 'Robert Wiśniewski', 'driver', 'rwisniewski@bakery.pl', True),
    ('mwojcik', 'Michał Wójcik', 'driver', 'mwojcik@bakery.pl', True),
    ('dkubiak', 'Damian Kubiak', 'driver', 'dkubiak@bakery.pl', True),
    ('sgorski', 'Sebastian Górski', 'driver', 'sgorski@bakery.pl', True),
]

SEED_USERNAMES = [row[0] for row in USER_DATA]

ROLE_TO_KEY = {'admin': 'admins', 'baker': 'bakers', 'driver': 'drivers'}

NOTIFICATION_TEMPLATES = [
    ('Niski stan magazynowy', 'Poziom surowca spadł poniżej progu minimalnego.'),
    ('Nowe zamówienie', 'Zarejestrowano nowe zamówienie od klienta.'),
    ('Raport gotowy', 'Raport finansowy za wczorajszy dzień został wygenerowany.'),
    ('Zmiana harmonogramu', 'Zaktualizowano harmonogram stałych zamówień.'),
    ('Dostawa surowców', 'Zamówienie surowcowe zostało częściowo przyjęte.'),
]


def create_users():
    result = {'admins': [], 'bakers': [], 'drivers': []}
    for username, full_name, role, email, is_active in USER_DATA:
        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                'full_name': full_name,
                'role': role,
                'email': email,
                'is_active': is_active,
            },
        )
        if created:
            user.set_password(SEED_PASSWORD)
            user.save()
        result[ROLE_TO_KEY[role]].append(user)
    return result


def create_notifications(users):
    all_users = users['admins'] + users['bakers'] + users['drivers']
    created_count = 0
    for user in all_users:
        for i in range(3):
            title, message = NOTIFICATION_TEMPLATES[(user.user_id + i) % len(NOTIFICATION_TEMPLATES)]
            _, created = Notification.objects.get_or_create(
                user=user,
                title=title,
                message=message,
                defaults={'is_read': (user.user_id + i) % 2 == 0},
            )
            if created:
                created_count += 1
    return created_count
