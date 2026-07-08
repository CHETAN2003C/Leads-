from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models


class UploadedCSV(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        VALIDATED = "validated", "Validated"
        PROCESSED = "processed", "Processed"
        FAILED = "failed", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="uploaded_csvs")
    original_filename = models.CharField(max_length=255)
    storage_path = models.CharField(max_length=500)
    file_size_bytes = models.PositiveIntegerField()
    row_count = models.PositiveIntegerField(null=True, blank=True)
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.PENDING)
    validation_errors = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)
