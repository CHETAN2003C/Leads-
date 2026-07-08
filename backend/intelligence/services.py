from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from leads.models import Lead
from leads.services import build_feature_snapshot

from .llm_service import generate_completion


def score_lead(lead: Lead) -> dict:
    features = build_feature_snapshot(lead)
    score = min(
        100,
        features["website_visits"] * 8
        + features["email_opens"] * 4
        + features["email_clicks"] * 7
        + features["demo_attendance"] * 25
        + features["pricing_page_visits"] * 10
        + features["content_downloads"] * 6,
    )
    if score >= 70:
        intent_bucket = "high"
    elif score >= 40:
        intent_bucket = "medium"
    else:
        intent_bucket = "low"

    explanation = (
        f"{intent_bucket.title()} intent - "
        f"visited pricing {features['pricing_page_visits']}x, "
        f"opened emails {features['email_opens']}x, "
        f"clicked emails {features['email_clicks']}x, "
        f"attended demos {features['demo_attendance']}x."
    )
    return {"score": score, "intent_bucket": intent_bucket, "explanation": explanation, "feature_snapshot": features}


def recommend_contact_window(lead: Lead) -> dict:
    activities = list(lead.activities.all().order_by("occurred_at"))
    if not activities:
        return {
            "best_contact_window_start": None,
            "best_contact_window_end": None,
            "preferred_channel": "email",
            "recommendation_type": "timing",
            "rationale": "No activity history is available yet, so default to email during a standard business window.",
        }

    hour_counts = Counter(activity.occurred_at.hour for activity in activities)
    weekday_counts = Counter(activity.occurred_at.weekday() for activity in activities)
    preferred_hour, _ = hour_counts.most_common(1)[0]
    preferred_weekday, _ = weekday_counts.most_common(1)[0]

    channel_counts = Counter((activity.channel or "email").lower() for activity in activities)
    preferred_channel, _ = channel_counts.most_common(1)[0]
    if preferred_channel not in {"email", "phone", "call", "linkedin", "sms"}:
        preferred_channel = "email"

    now = datetime.now(timezone.utc)
    day_delta = (preferred_weekday - now.weekday()) % 7
    target_start = (now + timedelta(days=day_delta)).replace(hour=preferred_hour, minute=0, second=0, microsecond=0)
    target_end = target_start + timedelta(hours=2)

    rationale = (
        f"Historical engagement clusters around weekday {preferred_weekday} at {preferred_hour:02d}:00, "
        f"with {preferred_channel} showing the highest usage."
    )
    return {
        "best_contact_window_start": target_start,
        "best_contact_window_end": target_end,
        "preferred_channel": preferred_channel,
        "recommendation_type": "timing",
        "rationale": rationale,
    }


def generate_sales_copilot(lead: Lead) -> dict:
    features = build_feature_snapshot(lead)
    score_payload = score_lead(lead)
    lead_name = f"{lead.first_name} {lead.last_name}".strip()
    company_name = lead.company_name or "their company"

    if score_payload["intent_bucket"] == "high":
        opener = f"{lead_name} from {company_name} is showing strong buying intent."
        tone = "direct and value-led"
        next_step = "Ask for a short decision-focused follow-up call."
    elif score_payload["intent_bucket"] == "medium":
        opener = f"{lead_name} from {company_name} is engaging but still warming up."
        tone = "helpful and specific"
        next_step = "Send a concise follow-up with one proof point and one clear CTA."
    else:
        opener = f"{lead_name} from {company_name} has early-stage engagement signals."
        tone = "low-pressure and educational"
        next_step = "Nurture with a useful resource and a soft check-in."

    email_subject = f"Next step for {company_name}"
    email_body = (
        f"Hi {lead.first_name or 'there'},\n\n"
        f"{opener} Based on recent activity, the strongest signals are pricing-page visits ({features['pricing_page_visits']}), "
        f"email opens ({features['email_opens']}), and demo attendance ({features['demo_attendance']}).\n\n"
        f"Suggested tone: {tone}.\n"
        f"{next_step}\n\n"
        f"Best,\nLeadPulse"
    )

    call_prep = [
        f"Open by referencing {company_name} and recent engagement patterns.",
        f"Focus on the fact that the lead scored {score_payload['score']} / 100 with {score_payload['intent_bucket']} intent.",
        f"Bring up pricing interest {features['pricing_page_visits']} times and demo activity {features['demo_attendance']} times.",
        "Confirm the buying committee, timeline, and preferred follow-up channel.",
    ]

    talking_points = [
        f"Lead score: {score_payload['score']} / 100",
        f"Intent bucket: {score_payload['intent_bucket'].title()}",
        f"Observed signals: pricing visits, email engagement, content downloads, and demo attendance.",
        f"Recommended action: {next_step}",
    ]

    follow_up_message = (
        f"Thanks for the time, {lead.first_name or 'team'}. "
        f"I wanted to circle back with the most relevant next step for {company_name}: {next_step}"
    )

    fallback_payload = {
        "subject": email_subject,
        "email_body": email_body,
        "call_prep": call_prep,
        "follow_up_message": follow_up_message,
        "talking_points": talking_points,
        "intent_bucket": score_payload["intent_bucket"],
        "score": score_payload["score"],
    }

    prompt = (
        f"Generate outreach assets for lead {lead_name} at {company_name}. "
        f"Score: {score_payload['score']}. Intent: {score_payload['intent_bucket']}. "
        f"Signals: pricing visits {features['pricing_page_visits']}, email opens {features['email_opens']}, "
        f"email clicks {features['email_clicks']}, demo attendance {features['demo_attendance']}."
    )
    return generate_completion(prompt, fallback_payload)
