from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone

from django.utils import timezone as django_timezone

from .models import Activity, Lead


@dataclass(slots=True)
class LeadFeatures:
    website_visits: int = 0
    email_opens: int = 0
    email_clicks: int = 0
    demo_attendance: int = 0
    pricing_page_visits: int = 0
    content_downloads: int = 0
    prior_interaction_count: int = 0
    company_size: int = 0
    time_since_last_contact_hours: int = 0
    industry: str = ""


def build_feature_snapshot(lead: Lead) -> dict:
    activities = list(lead.activities.all())
    type_counts = Counter(activity.activity_type for activity in activities)
    latest_activity = max((activity.occurred_at for activity in activities), default=None)
    hours_since_last_contact = 0
    if latest_activity is not None:
        if django_timezone.is_naive(latest_activity):
            latest_activity = django_timezone.make_aware(latest_activity, timezone.utc)
        delta = datetime.now(timezone.utc) - latest_activity.astimezone(timezone.utc)
        hours_since_last_contact = max(int(delta.total_seconds() // 3600), 0)

    return {
        "website_visits": type_counts.get("website_visit", 0),
        "email_opens": type_counts.get("email_open", 0),
        "email_clicks": type_counts.get("email_click", 0),
        "demo_attendance": type_counts.get("demo_attended", 0),
        "pricing_page_visits": type_counts.get("pricing_page_visit", 0),
        "content_downloads": type_counts.get("content_download", 0),
        "prior_interaction_count": len(activities),
        "company_size": lead.company_size or 0,
        "time_since_last_contact_hours": hours_since_last_contact,
        "industry": lead.industry,
    }
