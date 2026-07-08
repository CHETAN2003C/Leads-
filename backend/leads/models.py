from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models


class Lead(models.Model):
    class Status(models.TextChoices):
        NEW = "new", "New"
        WORKING = "working", "Working"
        QUALIFIED = "qualified", "Qualified"
        OPPORTUNITY = "opportunity", "Opportunity"
        WON = "won", "Won"
        LOST = "lost", "Lost"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="leads")
    external_id = models.CharField(max_length=128, null=True, blank=True, db_index=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField(null=True, blank=True, db_index=True)
    company_name = models.CharField(max_length=255)
    job_title = models.CharField(max_length=255, blank=True)
    industry = models.CharField(max_length=128, blank=True)
    company_size = models.PositiveIntegerField(null=True, blank=True)
    source = models.CharField(max_length=128, blank=True)
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.NEW)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"{self.first_name} {self.last_name}"


class Activity(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name="activities")
    activity_type = models.CharField(max_length=128)
    channel = models.CharField(max_length=64, blank=True)
    occurred_at = models.DateTimeField()
    value = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class Prediction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name="predictions")
    score = models.PositiveSmallIntegerField()
    intent_bucket = models.CharField(max_length=16)
    explanation = models.TextField(blank=True)
    model_name = models.CharField(max_length=64)
    model_version = models.CharField(max_length=64)
    feature_snapshot = models.JSONField(default=dict, blank=True)
    predicted_at = models.DateTimeField(auto_now_add=True)


class Recommendation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name="recommendations")
    best_contact_window_start = models.DateTimeField(null=True, blank=True)
    best_contact_window_end = models.DateTimeField(null=True, blank=True)
    preferred_channel = models.CharField(max_length=32)
    recommendation_type = models.CharField(max_length=64)
    rationale = models.TextField(blank=True)
    source_prediction = models.ForeignKey(Prediction, null=True, blank=True, on_delete=models.SET_NULL, related_name="recommendations")
    created_at = models.DateTimeField(auto_now_add=True)
