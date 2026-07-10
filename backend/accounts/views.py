from django.contrib.auth import authenticate, login, logout, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.utils import timezone
import re
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.utils.decorators import method_decorator
from rest_framework import status, viewsets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsSystemAdministrator
from .serializers import UserSerializer, AdminUserSerializer


class MeView(APIView):
    @method_decorator(ensure_csrf_cookie)
    def get(self, request):
        return Response(UserSerializer(request.user).data)


class CsrfView(APIView):
    permission_classes = [AllowAny]

    @method_decorator(ensure_csrf_cookie)
    def get(self, request):
        return Response({"detail": "CSRF cookie set."})


@method_decorator(csrf_protect, name="dispatch")
class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get("username", "")
        password = request.data.get("password", "")

        if not re.match(r"^[a-zA-Z0-9_.]+$", username) or not re.match(r"^[a-zA-Z0-9_.]+$", password):
            return Response({"detail": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)

        User = get_user_model()
        try:
            target_user = User.objects.get(username=username)
        except User.DoesNotExist:
            target_user = None

        if target_user:
            if target_user.is_locked_by_admin:
                return Response({"detail": "Account locked by administrator."}, status=status.HTTP_403_FORBIDDEN)
            if target_user.locked_until and target_user.locked_until > timezone.now():
                return Response({"detail": "Account temporarily locked. Try again later."}, status=status.HTTP_403_FORBIDDEN)

        user = authenticate(request, username=username, password=password)
        if user is None:
            if target_user:
                target_user.failed_login_attempts += 1
                if target_user.failed_login_attempts >= 5:
                    target_user.is_locked_by_admin = True
                    target_user.save()
                    return Response({"detail": "Account locked by administrator."}, status=status.HTTP_403_FORBIDDEN)
                elif target_user.failed_login_attempts >= 3:
                    target_user.locked_until = timezone.now() + timezone.timedelta(minutes=1)
                    target_user.save()
                    return Response({"detail": "Account temporarily locked. Try again later."}, status=status.HTTP_403_FORBIDDEN)
                else:
                    target_user.save()
            return Response({"detail": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)

        user.failed_login_attempts = 0
        user.locked_until = None
        user.save()

        login(request, user)
        return Response(UserSerializer(user).data)


@method_decorator(csrf_protect, name="dispatch")
class LogoutView(APIView):
    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get("username", "").strip()
        email = request.data.get("email", "").strip()
        password = request.data.get("password", "")
        role = request.data.get("role", "").strip()

        if not username or not email or not password or not role:
            return Response({"detail": "Username, email, password, and role are required."}, status=status.HTTP_400_BAD_REQUEST)

        if not re.match(r"^[a-zA-Z0-9_.]+$", username):
            return Response({"detail": "Username can only contain alphanumeric characters, underscores, and periods."}, status=status.HTTP_400_BAD_REQUEST)

        if not re.match(r"^[a-zA-Z0-9_.]+$", password):
            return Response({"detail": "Password can only contain alphanumeric characters, underscores, and periods."}, status=status.HTTP_400_BAD_REQUEST)

        User = get_user_model()
        if User.objects.filter(username=username).exists():
            return Response({"detail": "Username already exists."}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(email=email).exists():
            return Response({"detail": "Email already exists."}, status=status.HTTP_400_BAD_REQUEST)

        if role not in {choice[0] for choice in User.Role.choices}:
            return Response({"detail": "Invalid role specified."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            temp_user = User(username=username, email=email)
            validate_password(password, user=temp_user)
        except ValidationError as e:
            return Response({"detail": e.messages[0]}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create(
            username=username,
            email=email,
            role=role,
            is_active=False,  # Needs admin verification/activation
        )
        user.set_password(password)
        user.save()

        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class AdminUserViewSet(viewsets.ModelViewSet):
    User = get_user_model()
    queryset = User.objects.all().order_by("-date_joined")
    serializer_class = AdminUserSerializer
    permission_classes = [IsSystemAdministrator]

    def perform_update(self, serializer):
        is_locked = serializer.validated_data.get("is_locked_by_admin", None)
        if is_locked is False:
            serializer.save(failed_login_attempts=0, locked_until=None)
        else:
            serializer.save()
