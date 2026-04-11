# Role i uprawnienia

## Spis treści

- [Przegląd](#przegląd)
- [Mapowanie ról](#mapowanie-ról)
- [Matryca uprawnień](#matryca-uprawnień)
- [Impersonacja](#impersonacja)
- [Konfiguracja grup w Entra ID](#konfiguracja-grup-w-entra-id)
- [Przepływ uwierzytelniania](#przepływ-uwierzytelniania)

## Przegląd

System ról oparty jest na członkostwie w grupach zabezpieczeń Microsoft Entra ID. Rola jest przypisywana automatycznie na podstawie deklaracji grup (`groups` claim) w tokenie ID.

## Mapowanie ról

| Rola | Źródło | Warunek |
|------|--------|---------|
| `Administrator` | Entra ID | Użytkownik należy do grupy `ADMIN_GROUP_ID` |
| `Consultant` | Entra ID | Użytkownik należy do grupy `CONSULTANT_GROUP_ID` |
| `Unauthorized` | Brak grupy | Użytkownik nie należy do żadnej zdefiniowanej grupy |

### Priorytet

Jeśli użytkownik należy do obu grup, przypisywana jest rola `Administrator` (wyższy priorytet).

## Matryca uprawnień

| Operacja | Consultant | Administrator |
|----------|:----------:|:-------------:|
| **Kalendarz** | | |
| Podgląd własnego kalendarza | ✅ | ✅ |
| Rejestracja czasu (własna) | ✅ | ✅ |
| Edycja / usuwanie wpisów (własnych) | ✅ | ✅ |
| **Dashboard** | | |
| Podgląd KPI (własne dane) | ✅ | ✅ |
| Podgląd KPI (dowolny konsultant) | ❌ | ✅ |
| **Projekty** | | |
| Podgląd przypisanych projektów | ✅ | ✅ |
| Podgląd wszystkich projektów | ❌ | ✅ |
| **Raporty** | | |
| Dostęp do modułu raportów | ❌ | ✅ |
| Generowanie raportów | ❌ | ✅ |
| Eksport PDF | ❌ | ✅ |
| **Administracja** | | |
| Impersonacja konsultanta | ❌ | ✅ |
| ConsultantDock (wybór konsultanta) | ❌ | ✅ |

## Impersonacja

Administratorzy mogą przełączać widok na dowolnego konsultanta dzięki komponentowi **ConsultantDock** (prawy panel).

### Mechanizm

1. Admin wybiera konsultanta z listy (ConsultantDock)
2. `ViewingScopeContext` zapisuje kontekst w `sessionStorage`
3. Komponenty dashboard / kalendarz / KPI ładują dane wybranego konsultanta
4. Banner `ViewingBanner` informuje o trybie impersonacji
5. Zamknięcie panelu przywraca widok administratora

### Zabezpieczenia

- Tylko użytkownicy z rolą `Administrator` widzą ConsultantDock
- Impersonacja nie zmienia sesji — admin pozostaje zalogowany jako siebie
- Operacje zapisu delegowane są do API z parametrem `consultantId`
- `sessionStorage` resetuje się przy zamknięciu karty

## Konfiguracja grup w Entra ID

### 1. Utwórz grupy bezpieczeństwa

W Azure Portal → Entra ID → Groups:

| Grupa | Typ | Opis |
|-------|-----|------|
| `TT-Administrators` | Security | Administratorzy systemu |
| `TT-Consultants` | Security | Konsultanci (użytkownicy operacyjni) |

### 2. Skopiuj Object ID

Każda grupa ma unikalny **Object ID** (UUID) — skopiuj go do zmiennych środowiskowych.

### 3. Dodaj groups claim

W App Registration → Token configuration → Add groups claim:

1. Wybierz: **Security groups**
2. Token: **ID** (zaznacz)
3. Opcjonalnie: **Access** (jeśli używasz custom scope)

### 4. Skonfiguruj zmienne

```env
ADMIN_GROUP_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
CONSULTANT_GROUP_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

## Przepływ uwierzytelniania

```
Użytkownik → Login → Azure AD → Callback → NextAuth.js
                                                │
                                           JWT Token
                                           (groups claim)
                                                │
                                      ┌─────────┴──────────┐
                                      │   lib/auth-client   │
                                      │   hasPermission()   │
                                      └─────────┬──────────┘
                                                │
                                      ┌─────────┴──────────┐
                                      │  Sprawdzenie roli   │
                                      │  w id_token groups  │
                                      └─────────┬──────────┘
                                                │
                              ┌─────────────────┼─────────────────┐
                              │                 │                 │
                     Admin Group ID    Consultant Group ID   Brak grupy
                              │                 │                 │
                        Administrator      Consultant       Unauthorized
```

### Implementacja (`pages/api/auth/[...nextauth].ts`)

1. **OAuth callback** — wyciąga `groups[]` z `id_token`
2. **JWT callback** — mapuje grupy na role, zapisuje `oid`, `accessToken`
3. **Session callback** — eksponuje rolę i ID w sesji klienta
4. **Access token** — przechowywany w volatile store (in-memory, szyfrowany AES-256-GCM)
