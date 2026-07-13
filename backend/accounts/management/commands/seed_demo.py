from __future__ import annotations

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.utils import timezone

from leads.models import Activity, Lead, Prediction, Recommendation
from uploads.models import UploadedCSV
from intelligence.services import recommend_contact_window, score_lead


class Command(BaseCommand):
    help = "Seed a demo user and sample lead intelligence data for local development."

    def add_arguments(self, parser):
        parser.add_argument("--username", default="admin")
        parser.add_argument("--email", default="admin@leadpulse.local")
        parser.add_argument("--password", default="BlueRiver42")
        parser.add_argument("--first-name", default="System")
        parser.add_argument("--last-name", default="Administrator")

    def handle(self, *args, **options):
        User = get_user_model()
        user, created = User.objects.get_or_create(
            username=options["username"],
            defaults={
                "email": options["email"],
                "first_name": options["first_name"],
                "last_name": options["last_name"],
                "role": User.Role.SYSTEM_ADMINISTRATOR,
                "is_staff": True,
                "is_superuser": True,
            },
        )
        user.email = options["email"]
        user.first_name = options["first_name"]
        user.last_name = options["last_name"]
        user.role = User.Role.SYSTEM_ADMINISTRATOR
        user.is_staff = True
        user.is_superuser = True
        validate_password(options["password"], user=user)
        user.set_password(options["password"])
        user.save()

        sample_leads = [
            {
                "external_id": "lead-001",
                "first_name": "Ava",
                "last_name": "Chen",
                "email": "ava.chen@northstar.ai",
                "company_name": "Northstar AI",
                "job_title": "VP Revenue",
                "industry": "SaaS",
                "company_size": 420,
                "source": "website",
                "activity_type": "pricing_page_visit",
                "channel": "email",
                "offset_hours": 3,
            },
            {
                "external_id": "lead-002",
                "first_name": "Marcus",
                "last_name": "Bell",
                "email": "marcus@redwoodhealth.com",
                "company_name": "Redwood Health",
                "job_title": "Director of Sales",
                "industry": "Healthcare",
                "company_size": 980,
                "source": "campaign",
                "activity_type": "demo_attended",
                "channel": "call",
                "offset_hours": 18,
            },
            {
                "external_id": "lead-003",
                "first_name": "Nina",
                "last_name": "Patel",
                "email": "nina@vertexops.com",
                "company_name": "Vertex Ops",
                "job_title": "Revenue Operations Manager",
                "industry": "Operations",
                "company_size": 150,
                "source": "referral",
                "activity_type": "email_open",
                "channel": "email",
                "offset_hours": 30,
            },
        ]

        for index, lead_data in enumerate(sample_leads, start=1):
            lead, _created = Lead.objects.update_or_create(
                external_id=lead_data["external_id"],
                defaults={
                    "owner": user,
                    "first_name": lead_data["first_name"],
                    "last_name": lead_data["last_name"],
                    "email": lead_data["email"],
                    "company_name": lead_data["company_name"],
                    "job_title": lead_data["job_title"],
                    "industry": lead_data["industry"],
                    "company_size": lead_data["company_size"],
                    "source": lead_data["source"],
                    "status": Lead.Status.OPPORTUNITY if index == 1 else Lead.Status.WORKING,
                },
            )

            Activity.objects.create(
                lead=lead,
                activity_type=lead_data["activity_type"],
                channel=lead_data["channel"],
                occurred_at=timezone.now() - timedelta(hours=lead_data["offset_hours"]),
                metadata={
                    "website_visits": str(index + 1),
                    "email_opens": str(index * 2),
                    "email_clicks": str(index),
                    "demo_attended": "1" if lead_data["activity_type"] == "demo_attended" else "0",
                    "pricing_page_visits": "2" if lead_data["activity_type"] == "pricing_page_visit" else "0",
                    "content_downloads": "1",
                    "prior_interaction_count": str(index + 2),
                    "last_contact_at": (timezone.now() - timedelta(hours=lead_data["offset_hours"] + 1)).isoformat(),
                },
            )

            prediction_data = score_lead(lead)
            prediction = Prediction.objects.create(
                lead=lead,
                score=prediction_data["score"],
                intent_bucket=prediction_data["intent_bucket"],
                explanation=prediction_data["explanation"],
                model_name="random_forest",
                model_version="seed-demo-1",
                feature_snapshot=prediction_data["feature_snapshot"],
            )

            recommendation_data = recommend_contact_window(lead)
            Recommendation.objects.create(
                lead=lead,
                source_prediction=prediction,
                **recommendation_data,
            )

        UploadedCSV.objects.update_or_create(
            uploaded_by=user,
            original_filename="seed-demo.csv",
            defaults={
                "storage_path": "uploads/csv/seed-demo.csv",
                "file_size_bytes": 1024,
                "row_count": len(sample_leads),
                "status": UploadedCSV.Status.PROCESSED,
                "validation_errors": [],
                "processed_at": timezone.now(),
            },
        )

        self.stdout.write(self.style.SUCCESS(f"Demo data seeded for {user.username} / {options['password']}"))