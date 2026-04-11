# Wdrożenie / Deployment

Ten katalog zawiera dokumentację dotyczącą wdrażania aplikacji Developico Timesheet.

## Struktura

```
deployment/
├── README.md               ← ten plik
├── CHECKLIST.md             ← lista kontrolna wdrożenia
├── azure/
│   ├── APP_SERVICE_DEPLOYMENT.md    ← wdrożenie na Azure App Service
│   ├── AZURE_RESOURCES_SETUP.md     ← konfiguracja zasobów Azure
│   └── ENTRA_ID_KONFIGURACJA.md     ← konfiguracja Entra ID
└── local/
    └── LOCAL_DEVELOPMENT.md          ← lokalne środowisko deweloperskie
```

## Szybki start

1. **Nowy deweloper?** → [local/LOCAL_DEVELOPMENT.md](local/LOCAL_DEVELOPMENT.md)
2. **Pierwsze wdrożenie?** → [CHECKLIST.md](CHECKLIST.md) → [azure/AZURE_RESOURCES_SETUP.md](azure/AZURE_RESOURCES_SETUP.md)
3. **CI/CD deploy?** → [azure/APP_SERVICE_DEPLOYMENT.md](azure/APP_SERVICE_DEPLOYMENT.md)
4. **Konfiguracja auth?** → [azure/ENTRA_ID_KONFIGURACJA.md](azure/ENTRA_ID_KONFIGURACJA.md)
