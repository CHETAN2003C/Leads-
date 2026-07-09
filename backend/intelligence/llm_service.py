from __future__ import annotations

import json
import os
from urllib import request as urllib_request
from urllib.parse import urlparse


def generate_completion(prompt: str, fallback_payload: dict) -> dict:
    endpoint = os.getenv("LEADPULSE_LLM_ENDPOINT", "").strip()
    api_key = os.getenv("LEADPULSE_LLM_API_KEY", "").strip()

    if not endpoint:
        return fallback_payload

    # Validate that scheme is http or https to prevent SSRF
    parsed_url = urlparse(endpoint)
    if parsed_url.scheme not in ("http", "https"):
        return fallback_payload

    payload = json.dumps({"prompt": prompt}).encode("utf-8")
    http_request = urllib_request.Request(endpoint, data=payload, method="POST")
    http_request.add_header("Content-Type", "application/json")
    if api_key:
        http_request.add_header("Authorization", f"Bearer {api_key}")

    with urllib_request.urlopen(http_request, timeout=15) as response:
        body = response.read().decode("utf-8")
        try:
            parsed = json.loads(body)
        except json.JSONDecodeError:
            return fallback_payload

    if isinstance(parsed, dict) and parsed:
        return parsed

    return fallback_payload