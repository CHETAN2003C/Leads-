from __future__ import annotations

from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsMarketingOrAdmin
from intelligence.services import recommend_contact_window, score_lead
from leads.models import Activity, Lead
from leads.models import Prediction, Recommendation

from .models import UploadedCSV
from .serializers import UploadedCSVSerializer
from .services import validate_csv_upload


class CSVUploadView(APIView):
    permission_classes = [IsMarketingOrAdmin]

    def get(self, request):
        uploads = UploadedCSV.objects.filter(uploaded_by=request.user).order_by("-created_at")
        return Response(UploadedCSVSerializer(uploads, many=True).data)

    def post(self, request):
        uploaded_file = request.FILES.get("file")
        if uploaded_file is None:
            return Response({"detail": "A CSV file is required."}, status=status.HTTP_400_BAD_REQUEST)

        validation = validate_csv_upload(uploaded_file)
        record = UploadedCSV.objects.create(
            uploaded_by=request.user,
            original_filename=uploaded_file.name,
            storage_path=f"uploads/csv/{uploaded_file.name}",
            file_size_bytes=uploaded_file.size,
            row_count=len(validation.rows),
            status=UploadedCSV.Status.VALIDATED if validation.is_valid else UploadedCSV.Status.FAILED,
            validation_errors=validation.errors,
        )

        if not validation.is_valid:
            return Response(
                {"upload": UploadedCSVSerializer(record).data, "row_errors": validation.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            for row in validation.rows:
                lead_defaults = {
                    "owner": request.user,
                    "first_name": row.get("first_name", ""),
                    "last_name": row.get("last_name", ""),
                    "email": row.get("email") or None,
                    "company_name": row.get("company_name", ""),
                    "job_title": row.get("job_title", ""),
                    "industry": row.get("industry", ""),
                    "company_size": row.get("company_size"),
                    "source": row.get("source", ""),
                }

                if row.get("external_id"):
                    lead, _created = Lead.objects.update_or_create(
                        external_id=row.get("external_id"),
                        defaults=lead_defaults,
                    )
                else:
                    lead = Lead.objects.create(external_id=None, **lead_defaults)

                Activity.objects.create(
                    lead=lead,
                    activity_type=row.get("activity_type", ""),
                    channel=row.get("activity_channel", ""),
                    occurred_at=row.get("activity_timestamp") or timezone.now(),
                    value=row.get("activity_value") or None,
                    metadata={
                        "website_visits": row.get("website_visits", "0"),
                        "email_opens": row.get("email_opens", "0"),
                        "email_clicks": row.get("email_clicks", "0"),
                        "demo_attended": row.get("demo_attended", "0"),
                        "pricing_page_visits": row.get("pricing_page_visits", "0"),
                        "content_downloads": row.get("content_downloads", "0"),
                        "prior_interaction_count": row.get("prior_interaction_count", "0"),
                        "last_contact_at": row.get("last_contact_at", ""),
                    },
                )

                prediction_data = score_lead(lead)
                prediction = Prediction.objects.create(
                    lead=lead,
                    score=prediction_data["score"],
                    intent_bucket=prediction_data["intent_bucket"],
                    explanation=prediction_data["explanation"],
                    model_name="random_forest",
                    model_version="mvp-1",
                    feature_snapshot=prediction_data["feature_snapshot"],
                )

                recommendation_data = recommend_contact_window(lead)
                Recommendation.objects.create(
                    lead=lead,
                    source_prediction=prediction,
                    **recommendation_data,
                )

        record.status = UploadedCSV.Status.PROCESSED
        record.processed_at = timezone.now()
        record.save(update_fields=["status", "processed_at"])
        return Response({"upload": UploadedCSVSerializer(record).data}, status=status.HTTP_201_CREATED)
