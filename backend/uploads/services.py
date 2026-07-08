from __future__ import annotations

import csv
from dataclasses import dataclass
from io import TextIOWrapper
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Iterable

from django.core.files.uploadedfile import UploadedFile
from django.utils import timezone


EXPECTED_COLUMNS = [
    "external_id",
    "first_name",
    "last_name",
    "email",
    "company_name",
    "job_title",
    "industry",
    "company_size",
    "source",
    "activity_type",
    "activity_channel",
    "activity_timestamp",
    "activity_value",
    "website_visits",
    "email_opens",
    "email_clicks",
    "demo_attended",
    "pricing_page_visits",
    "content_downloads",
    "prior_interaction_count",
    "last_contact_at",
]

ALLOWED_EXTENSIONS = {".csv"}
MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024


@dataclass(slots=True)
class CSVValidationResult:
    is_valid: bool
    errors: list[dict]
    rows: list[dict]


def _parse_optional_int(value: str, field_name: str, errors: list[str]) -> int | None:
    if value == "":
        return None
    try:
        return int(value)
    except ValueError:
        errors.append(f"{field_name} must be an integer.")
        return None


def _parse_optional_decimal(value: str, field_name: str, errors: list[str]) -> Decimal | None:
    if value == "":
        return None
    try:
        return Decimal(value)
    except (InvalidOperation, ValueError):
        errors.append(f"{field_name} must be a decimal number.")
        return None


def _parse_optional_datetime(value: str, field_name: str, errors: list[str]) -> datetime | None:
    if value == "":
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if timezone.is_naive(parsed):
            parsed = timezone.make_aware(parsed, timezone.utc)
        return parsed
    except ValueError:
        errors.append(f"{field_name} must be an ISO 8601 datetime.")
        return None


def validate_csv_upload(uploaded_file: UploadedFile) -> CSVValidationResult:
    filename = uploaded_file.name.lower()
    if not any(filename.endswith(extension) for extension in ALLOWED_EXTENSIONS):
        return CSVValidationResult(False, [{"row": None, "errors": ["Only CSV files are allowed."]}], [])

    if uploaded_file.size > MAX_UPLOAD_SIZE_BYTES:
        return CSVValidationResult(False, [{"row": None, "errors": ["File exceeds the 5 MB limit."]}], [])

    uploaded_file.seek(0)
    wrapper = TextIOWrapper(uploaded_file.file, encoding="utf-8-sig")
    reader = csv.DictReader(wrapper)

    if reader.fieldnames is None:
        return CSVValidationResult(False, [{"row": None, "errors": ["CSV header row is missing."]}], [])

    missing_columns = [column for column in EXPECTED_COLUMNS if column not in reader.fieldnames]
    if missing_columns:
        return CSVValidationResult(False, [{"row": None, "errors": [f"Missing required columns: {', '.join(missing_columns)}"]}], [])

    rows: list[dict] = []
    errors: list[dict] = []
    for row_number, row in enumerate(reader, start=2):
        normalized = {key: (value or "").strip() for key, value in row.items()}
        row_errors: list[str] = []

        if not normalized.get("first_name"):
            row_errors.append("first_name is required.")
        if not normalized.get("last_name"):
            row_errors.append("last_name is required.")
        if not normalized.get("company_name"):
            row_errors.append("company_name is required.")

        company_size = _parse_optional_int(normalized.get("company_size", ""), "company_size", row_errors)
        activity_value = _parse_optional_decimal(normalized.get("activity_value", ""), "activity_value", row_errors)
        activity_timestamp = _parse_optional_datetime(normalized.get("activity_timestamp", ""), "activity_timestamp", row_errors)
        _parse_optional_int(normalized.get("website_visits", ""), "website_visits", row_errors)
        _parse_optional_int(normalized.get("email_opens", ""), "email_opens", row_errors)
        _parse_optional_int(normalized.get("email_clicks", ""), "email_clicks", row_errors)
        _parse_optional_int(normalized.get("demo_attended", ""), "demo_attended", row_errors)
        _parse_optional_int(normalized.get("pricing_page_visits", ""), "pricing_page_visits", row_errors)
        _parse_optional_int(normalized.get("content_downloads", ""), "content_downloads", row_errors)
        _parse_optional_int(normalized.get("prior_interaction_count", ""), "prior_interaction_count", row_errors)

        if row_errors:
            errors.append({"row": row_number, "errors": row_errors})
            continue

        normalized.update(
            {
                "company_size": company_size,
                "activity_value": activity_value,
                "activity_timestamp": activity_timestamp,
            }
        )
        rows.append(normalized)

    return CSVValidationResult(is_valid=not errors, errors=errors, rows=rows)


def row_iter(uploaded_file: UploadedFile) -> Iterable[dict]:
    uploaded_file.seek(0)
    wrapper = TextIOWrapper(uploaded_file.file, encoding="utf-8-sig")
    return csv.DictReader(wrapper)
