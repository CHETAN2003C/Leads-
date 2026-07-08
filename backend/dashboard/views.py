from rest_framework.response import Response
from rest_framework.views import APIView

from django.db.models import Max

from core.permissions import IsSalesRepresentativeOrManager
from leads.models import Lead, Prediction, Recommendation


class DashboardSummaryView(APIView):
    permission_classes = [IsSalesRepresentativeOrManager]

    def get(self, request):
        total_leads = Lead.objects.count()
        high_intent = Prediction.objects.filter(intent_bucket="high").count()
        top_opportunities = Lead.objects.filter(status="opportunity").count()
        latest_prediction_times = Prediction.objects.values("lead_id").annotate(latest_predicted_at=Max("predicted_at"))
        latest_predictions = []
        for row in latest_prediction_times:
            latest_prediction = Prediction.objects.filter(
                lead_id=row["lead_id"],
                predicted_at=row["latest_predicted_at"],
            ).first()
            if latest_prediction is not None:
                latest_predictions.append(latest_prediction)

        predicted_revenue = int(sum((prediction.score / 100) * 1000 for prediction in latest_predictions))
        daily_ai_insights = [
            f"{high_intent} leads are currently tagged high intent.",
            f"{Recommendation.objects.count()} follow-up recommendations are available.",
        ]
        return Response(
            {
                "total_leads": total_leads,
                "high_intent_leads": high_intent,
                "predicted_revenue": predicted_revenue,
                "daily_ai_insights": daily_ai_insights,
                "recommended_follow_ups": Recommendation.objects.count(),
                "top_opportunities": top_opportunities,
            }
        )
