from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.permissions import IsSalesRepresentativeOrManager
from intelligence.services import generate_sales_copilot, recommend_contact_window, score_lead

from .models import Lead, Prediction, Recommendation
from .serializers import LeadDetailSerializer, PredictionSerializer, RecommendationSerializer


class LeadViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Lead.objects.all().order_by("-created_at")
    serializer_class = LeadDetailSerializer
    permission_classes = [IsSalesRepresentativeOrManager]

    @action(detail=True, methods=["post"])
    def predict(self, request, pk=None):
        lead = self.get_object()
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
        return Response(PredictionSerializer(prediction).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["patch"], url_path="status")
    def status_update(self, request, pk=None):
        lead = self.get_object()
        next_status = request.data.get("status")
        valid_statuses = {choice for choice, _label in Lead.Status.choices}

        if next_status not in valid_statuses:
            return Response(
                {"detail": f"status must be one of: {', '.join(sorted(valid_statuses))}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        lead.status = next_status
        lead.save(update_fields=["status", "updated_at"])
        return Response(LeadDetailSerializer(lead).data)

    @action(detail=True, methods=["get", "post"], url_path="recommendations")
    def recommendations(self, request, pk=None):
        lead = self.get_object()

        if request.method == "GET":
            recommendations = lead.recommendations.select_related("source_prediction").order_by("-created_at")
            return Response(RecommendationSerializer(recommendations, many=True).data)

        with transaction.atomic():
            source_prediction = lead.predictions.order_by("-predicted_at").first()
            recommendation_data = recommend_contact_window(lead)
            recommendation = Recommendation.objects.create(
                lead=lead,
                source_prediction=source_prediction,
                **recommendation_data,
            )
        return Response(RecommendationSerializer(recommendation).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def copilot(self, request, pk=None):
        lead = self.get_object()
        return Response(generate_sales_copilot(lead), status=status.HTTP_200_OK)
