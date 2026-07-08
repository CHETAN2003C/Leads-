from rest_framework import serializers

from .models import Activity, Lead, Prediction, Recommendation


class ActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Activity
        fields = "__all__"


class PredictionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Prediction
        fields = "__all__"


class RecommendationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Recommendation
        fields = "__all__"


class LeadDetailSerializer(serializers.ModelSerializer):
    activities = ActivitySerializer(many=True, read_only=True)
    predictions = PredictionSerializer(many=True, read_only=True)
    recommendations = RecommendationSerializer(many=True, read_only=True)

    class Meta:
        model = Lead
        fields = [
            "id",
            "owner",
            "external_id",
            "first_name",
            "last_name",
            "email",
            "company_name",
            "job_title",
            "industry",
            "company_size",
            "source",
            "status",
            "created_at",
            "updated_at",
            "activities",
            "predictions",
            "recommendations",
        ]
