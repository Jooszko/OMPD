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

## 🚀 Status Projektu
Projekt jest w fazie rozwoju. Planowana data ukończenia - lato 2026, obrony - przełom roku 2026 i 2027.
