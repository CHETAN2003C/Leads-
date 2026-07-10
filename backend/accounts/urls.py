from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CsrfView, LoginView, LogoutView, MeView, RegisterView, AdminUserViewSet

router = DefaultRouter()
router.register("users", AdminUserViewSet, basename="admin-users")

urlpatterns = [
    path("csrf/", CsrfView.as_view()),
    path("login/", LoginView.as_view()),
    path("logout/", LogoutView.as_view()),
    path("me/", MeView.as_view()),
    path("register/", RegisterView.as_view()),
    path("", include(router.urls)),
]
