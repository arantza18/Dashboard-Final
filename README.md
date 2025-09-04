
# practica-dashboard-frontend

Frontend listo para correr (Vite + React + Tailwind) con carga de CSV, exploración y gráficas (Recharts).
Se integra opcionalmente con tu backend Django en `/api/datasets/` (POST/GET).

## Requisitos
- Node 18+

## Instalación
```bash
npm i
npm run dev
```

## Producción
```bash
npm run build
npm run preview
```

## Backend (opcional)
- Sirve Django en el **mismo dominio** (recomendado) o define `VITE_API_BASE_URL`.
- Endpoints esperados:
  - `POST /api/datasets/` (multipart/form-data: name, file)
  - `GET /api/datasets/`
  - `GET /api/datasets/:id`

El frontend envía cookies y CSRF (si existen) para compatibilidad con Django.
