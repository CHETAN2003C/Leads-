# LeadPulse MVP API Contract

This is the initial API surface for the MVP foundation. It is intentionally narrow and matches the documented build order.

## Auth

- `POST /api/auth/login/`
- `POST /api/auth/logout/`
- `GET /api/auth/me/`

## Uploads

- `POST /api/uploads/csv/` uploads a CSV file after server-side validation.
- `GET /api/uploads/csv/` lists prior uploads.
- `GET /api/uploads/csv/{id}/` returns validation status and row-level errors.

## Leads

- `GET /api/leads/` lists leads.
- `GET /api/leads/{id}/` returns lead detail, activities, prediction, and recommendation summary.
- `PATCH /api/leads/{id}/` updates allowed lead fields and status.

## Predictions

- `GET /api/leads/{id}/predictions/` returns prediction history.
- `POST /api/leads/{id}/predict/` runs feature extraction and scoring for a lead.

## Recommendations

- `GET /api/leads/{id}/recommendations/` returns timing and channel guidance.
- `POST /api/leads/{id}/recommendations/refresh/` recalculates recommendations.

## Dashboard

- `GET /api/dashboard/summary/` returns total leads, high-intent leads, predicted revenue, daily AI insights, recommended follow-ups, and top opportunities.

## Copilot

- `POST /api/leads/{id}/copilot/` generates outreach email, call prep, follow-up, and talking points.
