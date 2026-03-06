# Developico Timesheet — Propozycje rozwoju

> **Data:** 2026-03-06  
> **Dotyczy wersji:** v1.3.0  
> **Kontekst:** Aplikacja po fazie security hardening i refactoringu. Poniższe propozycje dotyczą nowych funkcjonalności i integracji AI.

---

## Spis treści

- [Developico Timesheet — Propozycje rozwoju](#developico-timesheet--propozycje-rozwoju)
  - [Spis treści](#spis-treści)
  - [1. Funkcjonalności AI](#1-funkcjonalności-ai)
    - [1.1 Inteligentne autouzupełnianie wpisów czasu](#11-inteligentne-autouzupełnianie-wpisów-czasu)
    - [1.2 Analiza anomalii w raportowaniu](#12-analiza-anomalii-w-raportowaniu)
    - [1.3 Asystent AI w kalendarzu (copilot sidebar)](#13-asystent-ai-w-kalendarzu-copilot-sidebar)
    - [1.4 Automatyczne podsumowania tygodniowe/miesięczne](#14-automatyczne-podsumowania-tygodniowemiesięczne)
    - [1.5 Predykcja budżetu i burndown projektów](#15-predykcja-budżetu-i-burndown-projektów)
    - [1.6 Smart categorization — automatyczne oznaczanie billable/non-billable](#16-smart-categorization--automatyczne-oznaczanie-billablenon-billable)
    - [1.7 Inteligentne alerty i przypomnienia](#17-inteligentne-alerty-i-przypomnienia)
  - [2. Ulepszenia funkcjonalne](#2-ulepszenia-funkcjonalne)
    - [2.1 Edycja i tworzenie wpisów czasu (CRUD)](#21-edycja-i-tworzenie-wpisów-czasu-crud)
    - [2.2 Workflow zatwierdzania wpisów (approval flow)](#22-workflow-zatwierdzania-wpisów-approval-flow)
    - [2.3 Raportowanie i eksport danych](#23-raportowanie-i-eksport-danych)
    - [2.4 Powiadomienia (notifications)](#24-powiadomienia-notifications)
    - [2.5 Szablony wpisów czasu (time entry templates)](#25-szablony-wpisów-czasu-time-entry-templates)
    - [2.6 Timer / Stoper pracy](#26-timer--stoper-pracy)
    - [2.7 Dashboard personalny konsultanta](#27-dashboard-personalny-konsultanta)
    - [2.8 Widok Gantt / timeline projektów](#28-widok-gantt--timeline-projektów)
    - [2.9 Zarządzanie absencjami i urlopami](#29-zarządzanie-absencjami-i-urlopami)
    - [2.10 Integracja z Microsoft Teams](#210-integracja-z-microsoft-teams)
    - [2.11 PWA i tryb offline](#211-pwa-i-tryb-offline)
    - [2.12 Widok miesięczny kalendarza](#212-widok-miesięczny-kalendarza)
  - [3. Matryca priorytetów](#3-matryca-priorytetów)
    - [Legenda](#legenda)
    - [AI Features](#ai-features)
    - [Functional Features](#functional-features)
    - [Sugerowana kolejność realizacji](#sugerowana-kolejność-realizacji)

---

## 1. Funkcjonalności AI

### 1.1 Inteligentne autouzupełnianie wpisów czasu

**Problem:** Konsultanci codziennie rejestrują wpisy z podobnymi wzorcami — te same projekty, podobne godziny, powtarzające się opisy zadań. Ręczne wypełnianie formularza jest czasochłonne i frustrujące.

**Rozwiązanie:** System analizujący historyczne wpisy użytkownika i sugerujący wypełnienie nowych wpisów na podstawie rozpoznanych wzorców.

**Jak to działa:**
1. Na podstawie wpisów z ostatnich 4–8 tygodni, model identyfikuje powtarzające się wzorce:
   - Jakie projekty użytkownik raportuje w poszczególne dni tygodnia
   - Typowy rozkład godzin (np. "pon–czw: 6h Projekt A + 2h Projekt B, pt: 4h Projekt C")
   - Najczęściej używane opisy zadań dla danego projektu
2. Przy otwieraniu pustego dnia w kalendarzu, system sugeruje wstępnie wypełnione wpisy
3. Użytkownik potwierdza lub modyfikuje sugestie jednym kliknięciem

**Implementacja techniczna:**
- **Wariant prosty (bez zewnętrznego AI):** Algorytm statystyczny w TypeScript — analiza rozkładu wpisów z N ostatnich tygodni, ważona mediana godzin per projekt per dzień tygodnia, najczęstszy opis jako default. Wystarczy `lib/ai/time-pattern-analyzer.ts` działający na danych z cache.
- **Wariant zaawansowany (Azure OpenAI):** Prompt z historią wpisów → model zwraca strukturyzowane sugestie w JSON. Lepsze rozpoznawanie kontekstu (np. "sprint review" pojawia się co 2 tygodnie w piątki).

**UX:**
- Pasek na górze kalendarza: "Sugerowane wpisy na dziś" z listą wpisów do zaakceptowania
- Przycisk "Zaakceptuj wszystkie" / "Edytuj" / "Odrzuć"
- Opcja "Kopiuj wpisy z poprzedniego tygodnia" jako fallback

**Szacowany wpływ:** Redukcja czasu rejestracji z ~5 min/dzień do ~30s dla typowych dni.

---

### 1.2 Analiza anomalii w raportowaniu

**Problem:** Menedżerowie nie mają narzędzia do szybkiego wykrywania nieprawidłowości — brakujących wpisów, nietypowego rozkładu godzin czy raportowania bez opisu zadań.

**Rozwiązanie:** Moduł AI identyfikujący anomalie i flagi jakościowe w danych o czasie pracy.

**Wykrywane anomalie:**
| Typ anomalii | Przykład | Priorytet |
|---|---|---|
| Brakujące wpisy | Konsultant nie zaraportował 3 dni w tygodniu | 🔴 |
| Nietypowe godziny | 12h w jednym dniu (przy normie 8h) | 🟡 |
| Podejrzane wpisy | 8h "meetings" bez konkretnego opisu przez cały tydzień | 🟡 |
| Nieprzypisany projekt | Wpisy na projekt, do którego konsultant nie jest przypisany | 🔴 |
| Nierówny rozkład | 40h w poniedziałek, 0h reszta tygodnia (retrospektywne bulk) | 🟡 |
| Budget alert | Projekt osiąga 90% budżetu godzinowego | 🔴 |

**Implementacja:**
- Dedykowany endpoint `/api/ai/anomalies` zwracający listę flag per konsultant/projekt
- Reguły oparte na statystyce (z-score od średniej konsultanta) + konfigurowalne progi
- Dashboard widżet "Quality Alerts" widoczny tylko dla admina

**Widok w UI:**
- Panel boczny z ikoną dzwonka na dashboardzie administracyjnym
- Lista anomalii z filtrowaniem po typie i konsultancie
- Quick action: kliknięcie w anomalię otwiera kontekst (np. kalendarz konsultanta na dany tydzień)

---

### 1.3 Asystent AI w kalendarzu (copilot sidebar)

**Problem:** Użytkownicy często muszą sami analizować swoje dane — ile godzin billable zaraportowali, na czym spędzili więcej czasu niż planowali, czy są na dobrej drodze do realizacji targetu.

**Rozwiązanie:** Chatbot / panel asystenta wbudowany w kalendarz, odpowiadający na pytania o dane użytkownika w języku naturalnym.

**Przykładowe interakcje:**
```
Użytkownik: "Ile billable godzin mam w tym miesiącu?"
Asystent:   "W marcu 2026 zaraportowałeś 87h billable (72% z 120h target). 
             Zostało 12 dni roboczych — potrzebujesz średnio 2.75h/dzień billable 
             żeby osiągnąć target."

Użytkownik: "Na czym spędziłem najwięcej czasu w ostatnim tygodniu?"
Asystent:   "Projekt Alpha: 24h (60%), Projekt Beta: 12h (30%), Internal: 4h (10%).
             Projekt Alpha to o 8h więcej niż tydzień wcześniej."

Użytkownik: "Wypełnij mi dzisiejszy dzień"
Asystent:   [Generuje sugestie wpisów na podstawie wzorców z 1.1]
```

**Implementacja:**
- Komponent `<CopilotSidebar>` z polem tekstowym i historią rozmowy
- Backend: endpoint `/api/ai/chat` proksujący do Azure OpenAI z kontekstem danych użytkownika
- System prompt zawiera: bieżące metryki konsultanta, listę projektów, target godzinowy
- Narzędzia (function calling): `getTimeEntries`, `getKPIMetrics`, `suggestEntries`

**Bezpieczeństwo:** Asystent widzi wyłącznie dane zalogowanego użytkownika (lub użytkownika w viewing scope dla admina). Kontekst budowany server-side, nigdy nie wysyłamy danych innych konsultantów.

---

### 1.4 Automatyczne podsumowania tygodniowe/miesięczne

**Problem:** Na koniec tygodnia/miesiąca konsultanci i menedżerowie potrzebują podsumowań — do raportów, faktur, spotkań statusowych. Ręczne zbieranie tych danych jest uciążliwe.

**Rozwiązanie:** Automatycznie generowane podsumowania w formie czytelnego tekstu + metryk.

**Zawartość podsumowania:**
- **Metryki:** Łączne godziny, billable %, podział per projekt, porównanie z targetem
- **Highlights:** Projekty z największym wzrostem/spadkiem godzin, projekty bliskie limitowi budżetowemu
- **Tekst narracyjny (AI):** "W tym tygodniu 65% czasu poświęciłeś na Projekt Alpha (Sprint 12), co jest zgodne z planem. Projekt Beta wymaga uwagi — zaraportowałeś 2h mniej niż w poprzednim tygodniu."
- **Action items:** Brakujące dni, wpisy bez opisu, projekty wymagające dopełnienia

**Dystrybucja:**
- Widżet na dashboardzie (domyślnie podsumowanie bieżącego tygodnia)
- Opcjonalny eksport do PDF
- Opcjonalna wysyłka e-mailem / wiadomość na Teams (przyszła integracja)

**Implementacja:**
- Endpoint `/api/ai/summary` przyjmujący zakres dat i typ (weekly/monthly)
- Generowanie tekstu przez Azure OpenAI z danymi jako kontekstem
- Cache podsumowania po wygenerowaniu (identyczny zakres dat → ten sam wynik)

---

### 1.5 Predykcja budżetu i burndown projektów

**Problem:** Menedżerowie dowiadują się o przekroczeniu budżetu godzinowego projektu post factum, kiedy jest już za późno na korektę.

**Rozwiązanie:** Moduł predykcyjny pokazujący prognozowane zużycie budżetu na podstawie trendu historycznego.

**Funkcjonalności:**
- **Wykres burndown:** Linia zużytego budżetu vs. linia idealnego zużycia vs. prognoza
- **Alert "Projected overrun":** Jeśli trend wskazuje na przekroczenie budżetu przed datą końcową projektu
- **Scenariusze "what-if":** Symulacja wpływu zmian (np. "co jeśli dodamy 1 konsultanta?" / "co jeśli zmniejszymy alokację o 20%?")

**Implementacja:**
- Model regresji liniowej / ARIMA na danych historycznych (godziny/tydzień per projekt)
- Dla prostych scenariuszy: regression w TypeScript (liniowa ekstrapolacja trendu z last 4-6 tygodni)
- Dla złożonych: Azure OpenAI z promptem zawierającym dane historyczne → odpowiedź strukturyzowana

**Widok:**
- Nowy widżet na dashboardzie: "At Risk Projects" — projekty z prognozowanym przekroczeniem
- Rozszerzenie panelu szczegółów projektu o zakładkę "Forecast"
- Kolorystyka: zielony (on track), żółty (>80% budżetu), czerwony (projected overrun)

---

### 1.6 Smart categorization — automatyczne oznaczanie billable/non-billable

**Problem:** Konsultanci czasem zapominają poprawnie oznaczyć wpis jako billable/non-billable, a błąd w tej kategoryzacji bezpośrednio wpływa na raportowanie finansowe.

**Rozwiązanie:** System sugerujący kategoryzację na podstawie projektu, opisu i wzorców historycznych.

**Jak to działa:**
1. Przy tworzeniu wpisu system automatycznie ustawia billable flag na podstawie:
   - Czy projekt jest oznaczony jako billable (najsilniejszy sygnał)
   - Opisu zadania (np. "internal meeting", "training" → non-billable)
   - Historycznego wzorca użytkownika dla tego projektu
2. Jeśli sugestia różni się od domyślnej wartości projektu, wyświetlany jest tooltip z uzasadnieniem
3. Użytkownik zawsze może nadpisać sugestię

**Implementacja:**
- Wariant prosty: rule-based engine z konfigurowalnymi regułami (regex na opisie + project metadata)
- Wariant AI: klasyfikator na Azure OpenAI analizujący kontekst wpisu

---

### 1.7 Inteligentne alerty i przypomnienia

**Problem:** Konsultanci zapominają o codziennym raportowaniu czasu, co prowadzi do retrospektywnego "bulk" wpisów z niższą dokładnością.

**Rozwiązanie:** System proaktywnych przypomnień dopasowujących się do nawyków użytkownika.

**Logika przypomnień:**
- **Brak wpisów:** Jeśli do godziny 16:00 brak wpisów na dany dzień → push notification / banner
- **Niekompletny dzień:** Jeśli suma godzin < 6h dla dnia roboczego → delikatne przypomnienie
- **Trend spadkowy:** Jeśli billable % spada przez 3 kolejne tygodnie → alert z sugestią przeglądu
- **Deadline budżetowy:** Jeśli projekt zbliża się do 90% budżetu → alert do konsultanta i PM-a
- **Adaptacyjność:** System uczy się godzin raportowania użytkownika i nie wysyła przypomnień o 9:00 komuś, kto konsekwentnie rejestruje czas o 17:00

**Kanały:**
- In-app banner/toast (natychmiastowy)
- Opcjonalnie: webhook do Microsoft Teams (przyszła integracja z 2.10)

---

## 2. Ulepszenia funkcjonalne

### 2.1 Edycja i tworzenie wpisów czasu (CRUD)

**Stan obecny:** Aplikacja pozwala na przeglądanie wpisów i ich tworzenie przez formularz kalendarza. Brakuje pełnego flow edycji, usuwania z potwierdzeniem oraz walidacji po stronie serwera (write-back do Dataverse).

**Propozycja:**
- **Inline edit:** Kliknięcie w istniejący wpis w kalendarzu otwiera formularz z prefill
- **Delete z potwierdzeniem:** Soft-delete z możliwością cofnięcia (undo toast, 5s window)
- **Bulk operations:** Zaznaczanie wielu wpisów → bulk edit (zmiana projektu/billable) lub bulk delete
- **Walidacja server-side:** Zapis do Dataverse z walidacją (max godzin/dzień, status projektu, przypisanie konsultanta)
- **Optimistic updates:** UI aktualizuje się natychmiast, w tle synchronizacja z Dataverse. Przy błędzie → rollback + komunikat

**Wymagane API:**
| Endpoint | Metoda | Opis |
|---|---|---|
| `/api/dataverse/timeentries` | POST | Tworzenie nowego wpisu |
| `/api/dataverse/timeentries/[id]` | PUT | Aktualizacja wpisu |
| `/api/dataverse/timeentries/[id]` | DELETE | Usunięcie wpisu |
| `/api/dataverse/timeentries/bulk` | PATCH | Bulk update |

---

### 2.2 Workflow zatwierdzania wpisów (approval flow)

**Stan obecny:** Wpisy mają status (pending/approved/rejected) ale brak mechanizmu workflow.

**Propozycja:**
- **Stany wpisu:** Draft → Submitted → Approved / Rejected → (edytowany) → Resubmitted
- **Role:** Konsultant submituje, PM lub Admin zatwierdza
- **Widok approval queue:** Dedykowana strona `/approvals` dla PM/Admin z listą wpisów do zatwierdzenia
- **Bulk approval:** Checkbox select + "Zatwierdź zaznaczone"
- **Komentarze:** Przy odrzuceniu — wymagany komentarz z uzasadnieniem
- **Lock:** Zatwierdzone wpisy zablokowane przed edycją (unlock wymaga admina)

**Widok:**
```
┌─────────────────────────────────────────────────┐
│ Approval Queue                        Filter ▾  │
├───────┬──────────┬──────────┬───────┬───────────┤
│ Data  │ Konsult. │ Projekt  │ Godz. │ Akcja     │
├───────┼──────────┼──────────┼───────┼───────────┤
│ 03-05 │ Jan K.   │ Alpha    │ 8h    │ ✓ ✗ 💬   │
│ 03-05 │ Anna M.  │ Beta     │ 6h    │ ✓ ✗ 💬   │
│ 03-04 │ Jan K.   │ Alpha    │ 7h    │ ✓ ✗ 💬   │
└───────┴──────────┴──────────┴───────┴───────────┘
```

---

### 2.3 Raportowanie i eksport danych

**Stan obecny:** Dashboard pokazuje KPI i wykresy ale brak dedykowanego modułu raportowego z eksportem.

**Propozycja:**
- **Kreator raportów:** Strona `/reports` z wyborem parametrów:
  - Zakres dat (tydzień / miesiąc / kwartał / custom)
  - Grupowanie: per konsultant / per projekt / per klient
  - Metryki: godziny, billable %, budżet, koszt
  - Filtrowanie: konkretny projekt, zespół, status wpisu
- **Formaty eksportu:**
  - CSV (do dalszej obróbki w Excel)
  - PDF (gotowy raport z wykresami i tabelami)
  - XLSX (z formatowaniem i formułami)
- **Predefiniowane raporty:**
  - Raport tygodniowy konsultanta
  - Raport miesięczny projektu
  - Raport utilization zespołu
  - Zestawienie billable godzin do fakturowania

**Implementacja:**
- Generowanie CSV/XLSX po stronie klienta (biblioteka SheetJS / xlsx)
- Generowanie PDF server-side (puppeteer lub @react-pdf/renderer)
- Scheduled reports: opcjonalny cron generujący raport i wysyłający mailem

---

### 2.4 Powiadomienia (notifications)

**Stan obecny:** Brak systemu powiadomień — użytkownik nie wie o zmianach statusu swoich wpisów ani o deadlinach.

**Propozycja:**
- **Notification center:** Ikona dzwonka w nagłówku z licznikiem nieprzeczytanych
- **Typy powiadomień:**
  - Wpis zatwierdzony / odrzucony
  - Nowe przypisanie do projektu
  - Przypomnienie o brakujących wpisach (z sekcji AI 1.7)
  - Alert budżetowy projektu
  - Systemowe (maintenance, nowe funkcje)
- **Persistencja:** Tabela powiadomień w Dataverse lub osobne storage
- **Real-time:** Server-Sent Events (SSE) lub polling co 60s
- **Ustawienia:** Strona `/settings/notifications` z per-type on/off

---

### 2.5 Szablony wpisów czasu (time entry templates)

**Problem:** Użytkownicy o stałym harmonogramie (np. 80% na jednym projekcie) codziennie wypełniają te same dane.

**Propozycja:**
- **Tworzenie szablonu:** Użytkownik definiuje zestaw wpisów (projekt + godziny + opis) jako szablon
- **Szablony systemowe:** Predefiniowane szablony per rola/zespół (np. "Standard dev day: 6h dev + 1h standup + 1h code review")
- **Aplikowanie:** W kalendarzu przycisk "Zastosuj szablon" → wybór szablonu → wstępne wypełnienie dnia
- **Edycja po zastosowaniu:** Szablon tylko prefilluje — użytkownik może modyfikować wartości

**Storage:** Szablony w localStorage (personal) lub Dataverse (shared/team).

---

### 2.6 Timer / Stoper pracy

**Problem:** Część konsultantów woli mierzyć czas w trakcie pracy zamiast wpisywać go retrospektywnie.

**Propozycja:**
- **Floating timer widget:** Mały widżet w rogu ekranu z aktualnym stoperem
- **Start/Pause/Stop:** Start wymaga wybrania projektu; stop generuje wpis z odmierzonym czasem
- **Podgląd aktywnego timera:** W nagłówku — "▶ Alpha — 2h 34m"
- **Automatyczne zaokrąglanie:** Konfigurowane (do 15 min / 30 min / bez)
- **Persistencja:** Stan timera w localStorage (przeżywa refresh strony)
- **Limit bezpieczeństwa:** Auto-stop po 12h (zapobiega zapomnieniu o wyłączeniu)

---

### 2.7 Dashboard personalny konsultanta

**Stan obecny:** Dashboard jest uniwersalny — te same widżety dla konsultanta i admina.

**Propozycja:**
- **Widok konsultanta:**
  - "Mój tydzień" — podsumowanie bieżącego tygodnia z progress barem do target
  - "Moje projekty" — lista aktywnych projektów z % zaangażowania
  - "Trend" — wykres godzin tygodniowych (ostatnie 8 tygodni) z linią trendu
  - "Cele" — personalny target billable % z progress trackerem
  - "Quick actions" — szybki wpis, timer, zastosuj szablon
- **Widok admina:**
  - "Zespół" — statusy wszystkich konsultantów (zaraportowane/brakujące)
  - "Projekty at risk" — projekty bliskie limitowi budżetowemu
  - "Approval queue" — pending wpisy do zatwierdzenia
  - "Utilization heatmap" — macierz konsultant × tydzień z kolorystycznym % utilization
- **Konfigurowalność:** Drag & drop widżetów, show/hide, resize (jak dashboardy BI)

---

### 2.8 Widok Gantt / timeline projektów

**Problem:** Brak wizualizacji nakładania się i rozłożenia projektów w czasie.

**Propozycja:**
- **Nowa strona:** `/projects/timeline`
- **Oś czasu:** Tygodniowa lub miesięczna siatka
- **Słupki:** Projekty jako kolorowe paski rozciągnięte od daty startu do daty końca
- **Zasoby:** Wariant per-konsultant — kto nad czym pracuje w danym tygodniu
- **Interakcje:** Kliknięcie w słupek → szczegóły projektu, hover → tooltip z metrykami

**Implementacja:** Biblioteka typu gantt-task-react lub custom SVG z d3.js.

---

### 2.9 Zarządzanie absencjami i urlopami

**Stan obecny:** System ma rudymentarny widok dni wolnych (holidays) ale brak pełnego zarządzania urlopami.

**Propozycja:**
- **Kalendarz absencji:** Widok roczny z oznaczonymi dniami wolnymi, urlopami, L4
- **Wnioskowanie o urlop:** Formularz z datami + typ absencji → zatwierdzenie przez managera
- **Saldo urlopowe:** Widżet z dostępnymi dniami urlopu (pull z HR system lub manual entry)
- **Automatyczne blokowanie:** Dni urlopowe blokują rejestrację czasu (lub automatycznie uzupełniają wpis "Urlop")
- **Kalendarz zespołowy:** Widok kto kiedy jest nieobecny (do planowania zasobów)

---

### 2.10 Integracja z Microsoft Teams

**Stan obecny:** Aplikacja działa wyłącznie jako web app. Brak integracji z narzędziami, z których konsultanci korzystają na co dzień.

**Propozycja:**
- **Teams Tab:** Osadzenie aplikacji jako zakładki w kanale Teams
- **Personal Bot:**
  - Przypomnienie o brakujących wpisach (DM do konsultanta)
  - Quick entry: `/timesheet 8h Alpha Sprint review` → wpis bez otwierania przeglądarki
  - Status: `/timesheet status` → podsumowanie tygodnia
- **Adaptive Cards:** Podsumowanie tygodniowe wysyłane jako karta do konwersacji
- **Webhook:** Powiadomienia Teams o zatwierdzeniu/odrzuceniu wpisów

**Implementacja:** Microsoft Bot Framework + Teams App Manifest. Backend jako Azure Function lub endpoint w istniejącej aplikacji.

---

### 2.11 PWA i tryb offline

**Problem:** Konsultanci pracujący w terenie lub w podróży (słabe połączenie) nie mogą rejestrować czasu.

**Propozycja:**
- **Service Worker:** Cache krytycznych zasobów (HTML, CSS, JS, logo)
- **Offline queue:** Wpisy tworzone offline zapisywane w IndexedDB → sync przy powrocie do sieci
- **Install prompt:** Możliwość "zainstalowania" aplikacji na pulpicie/ekranie głównym
- **Background sync:** Automatyczna synchronizacja oczekujących wpisów gdy sieć jest dostępna
- **Wskaźnik statusu:** Ikona online/offline w nagłówku

**Implementacja:** Next.js PWA plugin (next-pwa) + custom sync logic w Service Worker.

---

### 2.12 Widok miesięczny kalendarza

**Stan obecny:** Kalendarz obsługuje wyłącznie widok tygodniowy.

**Propozycja:**
- **Widok miesięczny:** Siatka 5–6 tygodni z podsumowaniem godzin na każdy dzień
- **Kolorystyczne oznaczenie:** Kolory komórek odzwierciedlające % wypełnienia dnia (zielony = 8h, żółty = <6h, czerwony = 0h)
- **Quick view:** Hover na dniu → tooltip z listą wpisów
- **Drill-down:** Kliknięcie w dzień → przejście do widoku tygodniowego z fokusem na wybrany dzień
- **Przełącznik:** Toggle tydzień / miesiąc w nagłówku kalendarza

---

## 3. Matryca priorytetów

Priorytety wynikają ze stosunku wartości biznesowej do złożoności implementacji.

### Legenda
- **Wpływ:** Jak bardzo funkcja wpłynie na produktywność użytkowników i wartość biznesową
- **Złożoność:** Przewidywany nakład pracy na implementację
- **Zależności:** Czy wymaga wcześniejszego ukończenia innych funkcji

### AI Features

| # | Funkcjonalność | Wpływ | Złożoność | Zależności | Priorytet |
|---|---|---|---|---|---|
| 1.1 | Autouzupełnianie wpisów | 🟢 Wysoki | 🟡 Średnia | 2.1 (CRUD) | **P1** |
| 1.2 | Anomaly detection | 🟢 Wysoki | 🟡 Średnia | — | **P1** |
| 1.3 | Copilot sidebar | 🟡 Średni | 🔴 Wysoka | Azure OpenAI | **P3** |
| 1.4 | Podsumowania tygodniowe | 🟢 Wysoki | 🟢 Niska | — | **P1** |
| 1.5 | Predykcja budżetu | 🟡 Średni | 🟡 Średnia | — | **P2** |
| 1.6 | Smart categorization | 🟡 Średni | 🟢 Niska | — | **P2** |
| 1.7 | Inteligentne alerty | 🟢 Wysoki | 🟡 Średnia | 2.4 (Notif.) | **P2** |

### Functional Features

| # | Funkcjonalność | Wpływ | Złożoność | Zależności | Priorytet |
|---|---|---|---|---|---|
| 2.1 | CRUD wpisów czasu | 🔴 Krytyczny | 🟡 Średnia | — | **P0** |
| 2.2 | Approval workflow | 🟢 Wysoki | 🟡 Średnia | 2.1 | **P1** |
| 2.3 | Raporty i eksport | 🟢 Wysoki | 🟡 Średnia | — | **P1** |
| 2.4 | Powiadomienia | 🟡 Średni | 🟡 Średnia | — | **P2** |
| 2.5 | Szablony wpisów | 🟡 Średni | 🟢 Niska | 2.1 | **P2** |
| 2.6 | Timer / Stoper | 🟡 Średni | 🟢 Niska | 2.1 | **P2** |
| 2.7 | Dashboard personalny | 🟢 Wysoki | 🟡 Średnia | — | **P1** |
| 2.8 | Widok Gantt | 🟡 Średni | 🟡 Średnia | — | **P3** |
| 2.9 | Zarządzanie absencjami | 🟡 Średni | 🟡 Średnia | — | **P2** |
| 2.10 | Integracja Teams | 🟢 Wysoki | 🔴 Wysoka | 2.1, 2.4 | **P3** |
| 2.11 | PWA / Offline | 🟡 Średni | 🟡 Średnia | 2.1 | **P3** |
| 2.12 | Widok miesięczny | 🟡 Średni | 🟢 Niska | — | **P2** |

### Sugerowana kolejność realizacji

```
Faza A (Fundamenty)         ───────────────────────
  2.1  CRUD wpisów czasu                      P0
  
Faza B (Wartość biznesowa)  ─────────────────────────────────
  2.2  Approval workflow                      P1
  2.3  Raporty i eksport                      P1
  2.7  Dashboard personalny                   P1
  1.4  Podsumowania AI                        P1
  1.2  Anomaly detection                      P1

Faza C (Produktywność)      ─────────────────────────────────────────
  1.1  Autouzupełnianie                       P1
  2.5  Szablony wpisów                        P2
  2.6  Timer / Stoper                         P2
  1.5  Predykcja budżetu                      P2
  1.6  Smart categorization                   P2
  2.12 Widok miesięczny                       P2

Faza D (Ekosystem)          ─────────────────────────────────────────────────
  2.4  Powiadomienia                          P2
  1.7  Inteligentne alerty                    P2
  2.9  Zarządzanie absencjami                 P2
  
Faza E (Rozszerzenia)       ─────────────────────────────────────────────────────
  1.3  Copilot sidebar                        P3
  2.8  Widok Gantt                            P3
  2.10 Integracja Teams                       P3
  2.11 PWA / Offline                          P3
```

---

> **Uwaga:** Dokument przedstawia propozycje rozwoju do dyskusji. Szczegółowy plan implementacji (z zadaniami, estymacjami i zależnościami technicznymi) powinien zostać opracowany po wyborze priorytetów i zatwierdzeniu zakresu.
