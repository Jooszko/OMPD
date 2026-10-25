# System Wspierania Zamówień, Produkcji i Dystrybucji

Zintegrowany system informatyczny klasy ERP/MES dedykowany dla małych i średnich przedsiębiorstw produkcyjnych.

## 👥 Autorzy
* **Jonasz Kubaczka**
* **Arkadiusz Hebda**
* **Mikołaj Klukowski**

**Przewidywany termin obrony:** przełom 2026/2027

---

## 📝 1. Koncepcja i Wizja Projektu
Celem projektu jest stworzenie centralnej platformy zarządzania danymi, która integruje kluczowe procesy biznesowe firmy. Aplikacja pozwala na odejście od rozproszonych arkuszy kalkulacyjnych na rzecz spójnej bazy danych, co minimalizuje ryzyko błędów i optymalizuje czas realizacji zleceń.

### Kluczowe moduły:
* **Moduł Zamówień:** Zarządzanie bazą klientów, automatyzacja wycen oraz śledzenie przepływów finansowych.
* **Moduł Produkcji:** Harmonogramowanie pracy, zarządzanie recepturami (BOM) oraz kontrola zużycia surowców.
* **Moduł Dystrybucji i Magazynu:** Ewidencja stanów magazynowych i generowanie dokumentacji wydań.
* **Dashboardy:** Personalizowane widoki danych dostosowane do pełnionych ról w organizacji.

---

## 🏗 2. Architektura i Technologie
System oparty jest na architekturze klient-serwer, co zapewnia skalowalność i bezpieczeństwo danych poprzez separację warstwy prezentacji od logiki biznesowej.

* **Backend:** Django (Python)
* **Frontend:** React.js
* **Baza danych:** PostgreSQL
* **Komunikacja:** REST API.

---

## 🛠 3. Przewidywane Funkcjonalności

### Zarządzanie i Operacje
* **Panel Dashboard:** Wizualizacja obciążenia produkcji i nadchodzących terminów w czasie rzeczywistym.
* **Obsługa produkcji:** Szczegółowy wgląd w zlecenia produkcyjne zaplanowane na dany dzień.
* **Powiadomienia:** System alertów informujący o niskim poziomie surowców w magazynie.

### Administracja i Kontrola
* **System ról (RBAC):** Dedykowane uprawnienia i widoki dla handlowca, kierownika produkcji oraz magazyniera.
* **Historia zmian (Audit Log):** Pełna identyfikowalność działań – system rejestruje kto i kiedy modyfikował kluczowe dane (np. status zamówienia, stan magazynowy).

### Raportowanie i Finanse
* **Analityka finansowa:** Monitorowanie bieżących obrotów i rentowności.
* **Generator raportów:** Narzędzie do tworzenia zestawień okresowych z wybranych procesów firmy.

---

## 🐳 Uruchomienie w Dockerze
1. Skopiuj `.env.docker.example` jako `.env.docker` i uzupełnij wartości.
2. `docker compose up --build -d` – aplikacja pod http://localhost:8080
3. Dane testowe: `docker compose exec backend python manage.py seed_dashboard --clear --password 'TwojeHaslo'`

---

## 🧪 Dane testowe (seed)
Komendy uruchamiamy w `backend/` (lokalnie) albo przez `docker compose exec backend ...` (Docker / serwer).

| Komenda | Co robi |
|---|---|
| `python manage.py seed_dashboard --clear` | Czyści bazę i tworzy pół roku historii piekarni: 40 klientów z prawdziwymi adresami na 6 trasach, zamówienia stałe i dzienne (dni tygodnia, święta, sezon), zwroty, dowody dostaw, plany produkcji, wydatki i zamknięte dni w finansach. Ok. 15 s. |
| `python manage.py seed_today_deliveries` | Szybkie odświeżenie bez kasowania: zamyka zaległe dostawy, tworzy zamówienia na dziś i jutro. Na serwerze uruchamia ją cron codziennie o 5:00. |

Opcje `seed_dashboard`:
* `--days 30` – krótsza historia (domyślnie 180 dni),
* `--password 'Haslo'` – hasło wszystkich kont testowych; przy `DEBUG=True` domyślnie `bakery2026`, przy `DEBUG=False` hasło jest wymagane (albo zmienna `SEED_PASSWORD`),
* `--demo` – aktywne zostają tylko konta do pokazu: `mklukowski` (admin), `akrawczyk` (piekarz), `jnowak` (kierowca).

Serwer demo po zmianach w seedzie: `seed_dashboard --clear --demo --password '...'`.

Serwer demo (https://bakery.rauhvin.pl) sam pobiera zmiany z `main` co 10 minut i po każdym starcie maszyny (`scripts/server-update.sh`).

---

## 📖 Dokumentacja API
Przy `DEBUG=True` (lokalnie) backend udostępnia dokumentację generowaną z kodu (drf-spectacular, OpenAPI 3):
* http://localhost:8000/api/docs/ – Swagger UI: lista endpointów z możliwością wywołania (token z `POST /api/auth/login/` wklejamy w **Authorize**),
* http://localhost:8000/api/redoc/ – ta sama dokumentacja w wersji do czytania,
* `python manage.py spectacular --file openapi.yaml` – zapis schematu do pliku.

Na serwerze (`DEBUG=False`) dokumentacja jest wyłączona. Można ją włączyć zmienną `API_DOCS_ENABLED=True`.

---

## 🚀 Status Projektu
Projekt jest w fazie rozwoju. Planowana data ukończenia - lato 2026, obrony - przełom roku 2026 i 2027.
