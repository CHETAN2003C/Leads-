# Project Biodata

## Project Name
LeadPulse

## What This Project Does
LeadPulse is a revenue intelligence MVP for sales and marketing teams. It collects lead data, validates uploaded CSVs, stores lead activity, scores intent, and shows a dashboard with follow-up guidance. The app is designed to answer a simple business question: which leads are ready for sales attention right now?

## End-to-End Flow
1. A user uploads a CSV containing leads or activity data.
2. The backend validates the file format, required fields, and row quality.
3. The data is stored in SQLite during development.
4. Lead scoring logic calculates an intent score and buckets each lead as low, medium, or high intent.
5. The dashboard surfaces the most important leads and suggested next actions.
6. A demo seed command can populate the app with sample login data and lead records for local testing.

## Technology Stack
### Backend
- Python
- Django 5
- Django REST Framework
- SQLite
- django-cors-headers
- python-dotenv

### Frontend
- React 18
- Vite
- JavaScript
- CSS

### Data and Intelligence
- Django models for users, leads, activities, predictions, recommendations, and uploads
- A scoring service that converts activity signals into intent buckets using deterministic rules
- Recommendation logic that selects contact timing and preferred channel
- An optional external LLM endpoint for generated copilot content when `LEADPULSE_LLM_ENDPOINT` is configured

## ML Model Status
This MVP does not train or bundle a local machine learning model.

The current intent scoring is rule-based and explainable, which keeps the first release predictable and easy to debug. The project can still call an external LLM service for generated sales copilot content if an endpoint is configured, but that is an optional integration rather than a required part of the core app.

## How The LLM Works
The project does not train its own LLM inside this repository.

Instead, if `LEADPULSE_LLM_ENDPOINT` is configured, the backend sends a prompt to an external LLM API. That provider owns the model training, hosting, and inference. This project only prepares the prompt from lead data and reads back the response. If the endpoint is missing or the response is invalid, the app falls back to deterministic content generated in code.

In short:
- model training happens outside this repo
- this repo performs prompt construction and response handling
- the fallback path keeps the app working even with no LLM configured

## How Data Is Fetched And Used
The project fetches data in three main ways.

### 1. CSV Uploads
Users upload CSV files through the backend upload API. The file is validated server-side, then parsed row by row. Required fields and numeric/date fields are checked before any row is accepted. Valid rows can then be turned into leads and activity records.

### 2. Database Reads
The frontend does not read the database directly. It calls Django REST Framework endpoints such as lead lists, lead detail, dashboard summary, uploads, and auth endpoints. The backend reads the data from SQLite during development and returns JSON to the frontend.

### 3. Demo Seeding
The `seed_demo` command creates a local admin account plus sample leads, activities, predictions, recommendations, and upload metadata. This gives the UI something meaningful to display without needing a live CRM.

### What Happens After Data Is Fetched
- Lead and activity data are stored in Django models.
- The scoring service builds a feature snapshot from activity history.
- The score is converted into low, medium, or high intent.
- The recommendation logic chooses contact timing and preferred channel.
- The frontend fetches the final JSON response and renders the dashboard.

## Why These Technologies Are Used
### Python and Django
Django is used because it gives a secure, structured backend very quickly. It handles authentication, models, migrations, admin support, and API organization without needing a lot of custom plumbing.

### Django REST Framework
DRF is used because the project is API-first. The frontend and backend communicate through JSON endpoints, so DRF gives serializers, views, permissions, and consistent request handling.

### SQLite
SQLite is used for local development because it is lightweight, fast to set up, and requires no separate database server. That makes the MVP easy to run on any machine.

### React and Vite
React is used for the UI because the dashboard is component-driven and needs reusable screens for upload, lead detail, and summary views. Vite is used because it gives a fast dev server and a simple modern build pipeline.

### dotenv and CORS support
dotenv keeps environment settings outside the source code. CORS support is needed because the frontend and backend run on different local ports during development.

## How The Project Uses The Stack
- Django models define the business data shape.
- Django REST Framework exposes those models through APIs.
- Permissions enforce role-based access at the API layer.
- Scoring services convert engagement signals into low, medium, and high intent.
- The system can optionally call an external LLM endpoint for generated outreach content.
- The React app consumes those APIs and presents the operational dashboard.
- Vite keeps frontend iteration fast while the backend runs independently.

## Why We Are Only Using These Tools
The stack is intentionally small because this is an MVP. Fewer technologies mean:
- faster local setup
- fewer moving parts
- easier debugging
- lower maintenance overhead
- clearer separation between product logic and presentation

This project does not introduce extra frameworks unless they are necessary. That keeps the implementation focused on the core workflow: upload, validate, score, and act.

## Core Modules
- `backend/accounts`: authentication, users, and demo seeding
- `backend/leads`: lead data, activities, predictions, and recommendations
- `backend/uploads`: CSV upload handling and validation
- `backend/intelligence`: scoring and recommendation logic
- `frontend/src`: the React interface for the dashboard and lead operations

## Local Development Setup
1. Install backend Python dependencies from `backend/requirements.txt`.
2. Run Django migrations.
3. Start the backend server with `python manage.py runserver`.
4. Install frontend dependencies with `npm install` in `frontend/`.
5. Start the frontend with `npm run dev`.
6. Run `python manage.py seed_demo` to create a working login and sample leads.

## Demo Login
- Username: `admin`
- Password: `LeadPulse123!`

## Intent Data Note
The sample CSV files in `data/` are split into separate low, medium, and high intent files. They use Indian names and the same intent buckets used by the scoring service so the sample data matches the application logic.