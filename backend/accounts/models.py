from __future__ import annotations

import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        SALES_REPRESENTATIVE = "sales_representative", "Sales Representative"
        SALES_MANAGER = "sales_manager", "Sales Manager"
        MARKETING_EXECUTIVE = "marketing_executive", "Marketing Executive"
        SYSTEM_ADMINISTRATOR = "system_administrator", "System Administrator"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=64, choices=Role.choices, default=Role.SALES_REPRESENTATIVE)
    failed_login_attempts = models.IntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    is_locked_by_admin = models.BooleanField(default=False)

    def __str__(self) -> str:
        return self.get_username()
