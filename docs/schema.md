# LeadPulse MVP Schema

This is the minimum viable schema for the MVP. Table names are kept explicit to match the PRD scope.

## Users

- `id` UUID primary key
- `username` varchar, unique, required
- `email` varchar, unique, required
- `password` varchar, required
- `role` enum: `sales_representative`, `sales_manager`, `marketing_executive`, `system_administrator`
- `is_active` boolean, default `true`
- `is_staff` boolean, default `false`
- `created_at` datetime
- `updated_at` datetime

Relationships:

- One `Users` record owns many `Leads`.
- One `Users` record uploads many `UploadedCSVs`.

## Leads

- `id` UUID primary key
- `owner_id` foreign key to `Users`, nullable
- `external_id` varchar, nullable, indexed
- `first_name` varchar
- `last_name` varchar
- `email` varchar, nullable, indexed
- `company_name` varchar
- `job_title` varchar, nullable
- `industry` varchar, nullable
- `company_size` integer, nullable
- `source` varchar, nullable
- `status` enum or varchar for MVP workflow state
- `created_at` datetime
- `updated_at` datetime

Relationships:

- One `Leads` record has many `Activities`.
- One `Leads` record has many `Predictions`.
- One `Leads` record has many `Recommendations`.

## Activities

- `id` UUID primary key
- `lead_id` foreign key to `Leads`
- `activity_type` varchar, required
- `channel` varchar, nullable
- `occurred_at` datetime, required
- `value` decimal or integer, nullable
- `metadata` JSON
- `created_at` datetime

Relationships:

- Every activity belongs to one lead.

## Predictions

- `id` UUID primary key
- `lead_id` foreign key to `Leads`
- `score` integer from 0 to 100
- `intent_bucket` enum: `high`, `medium`, `low`
- `explanation` text
- `model_name` varchar
- `model_version` varchar
- `feature_snapshot` JSON
- `predicted_at` datetime

Relationships:

- One lead can have many prediction records over time.

## Recommendations

- `id` UUID primary key
- `lead_id` foreign key to `Leads`
- `best_contact_window_start` datetime, nullable
- `best_contact_window_end` datetime, nullable
- `preferred_channel` varchar
- `recommendation_type` varchar
- `rationale` text
- `source_prediction_id` foreign key to `Predictions`, nullable
- `created_at` datetime

Relationships:

- One recommendation is based on one lead and can reference the prediction that informed it.

## UploadedCSVs

- `id` UUID primary key
- `uploaded_by_id` foreign key to `Users`
- `original_filename` varchar
- `storage_path` varchar
- `file_size_bytes` integer
- `row_count` integer, nullable
- `status` enum: `pending`, `validated`, `processed`, `failed`
- `validation_errors` JSON
- `created_at` datetime
- `processed_at` datetime, nullable

Relationships:

- One uploaded CSV can produce many leads and activities.
