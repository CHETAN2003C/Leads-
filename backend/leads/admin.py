from django.contrib import admin

from .models import Activity, Lead, Prediction, Recommendation


@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    list_display = ("first_name", "last_name", "company_name", "status", "owner")
    search_fields = ("first_name", "last_name", "company_name", "email")


admin.site.register(Activity)
admin.site.register(Prediction)
admin.site.register(Recommendation)
