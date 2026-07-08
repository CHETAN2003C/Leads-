from django.urls import include, path

urlpatterns = [
    path("auth/", include("accounts.urls")),
    path("leads/", include("leads.urls")),
    path("uploads/", include("uploads.urls")),
    path("dashboard/", include("dashboard.urls")),
]
