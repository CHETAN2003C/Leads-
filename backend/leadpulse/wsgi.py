"""WSGI config for LeadPulse."""

import os

from django.core.wsgi import get_wsgi_application


os.environ.setdefault("DJANGO_SETTINGS_MODULE", "leadpulse.settings")

application = get_wsgi_application()
