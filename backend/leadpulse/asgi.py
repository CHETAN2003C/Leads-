"""ASGI config for LeadPulse."""

import os

from django.core.asgi import get_asgi_application


os.environ.setdefault("DJANGO_SETTINGS_MODULE", "leadpulse.settings")

application = get_asgi_application()
