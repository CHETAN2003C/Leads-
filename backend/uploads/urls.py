from django.urls import path

from .views import CSVUploadView

urlpatterns = [
    path("csv/", CSVUploadView.as_view()),
]
