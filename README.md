# LeadPulse

LeadPulse is an AI Revenue Intelligence Platform that sits on top of existing CRMs. This repository contains the MVP foundation: Django backend, React frontend scaffold, CSV ingestion, scoring pipeline stubs, and security-first defaults.

## MVP Shape

- CSV-only ingestion for leads and activities.
- Django REST backend with RBAC and secure defaults.
- React SPA for dashboard, upload, and lead views.
- SQLite for development with a PostgreSQL-ready schema.

## Repository Layout

- `backend/` Django project and API.
- `frontend/` React SPA.
- `docs/` schema and API contract notes.

## Local Run

1. Copy `backend/.env.example` to `backend/.env` and set `DJANGO_SECRET_KEY`.
2. Copy `frontend/.env.example` to `frontend/.env` if you want to override the API base URL.
3. From `backend/`, run `python manage.py migrate` and then `python manage.py runserver`.
4. From `frontend/`, run `npm install` once and then `npm run dev`.
5. To create a usable login and sample data, run `python manage.py seed_demo` from `backend/`.

## Current Status

- Database migrations are created and applied.
- Django system checks pass.
- The React production build passes.
- The frontend dependency audit reports 2 vulnerabilities in third-party packages; they are not blocking the build.
- Demo bootstrap command available: `python manage.py seed_demo`.
