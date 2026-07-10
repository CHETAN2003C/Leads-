# LeadPulse Security Controls & OWASP Mapping

This document details the secure coding practices and architectural security controls implemented in LeadPulse, mapped against the OWASP Top 10 categories.

---

## 1. A01:2021 — Broken Access Control

### Implementation
- **Backend Permissions**: Enforced custom Django REST Framework permission classes:
  - `IsSystemAdministrator`: Restricts endpoints to users where `role == "system_administrator"`.
  - `IsSalesRepresentativeOrManager`: Restricts lead query endpoints to sales reps/managers.
  - `IsMarketingOrAdmin`: Restricts CSV import views to marketing or admin roles.
- **Frontend Tabs & Route Controls**: Conditionally renders sidebar navigation items and fallback error blocks in React (`App.jsx`) to enforce client-side permission barriers.

### Risk Mitigation
- Prevents Insecure Direct Object References (IDOR) and unauthorized queries. Users cannot scan leads, upload templates, or access administrative listings outside their designated roles.

---

## 2. A03:2021 — Injection

### Implementation
- **ORM Parameterization**: Database queries are built using Django's ORM, separating query instructions from user-provided data parameters.
- **Sanitization & RegEx Checks**: Added strict validation check limits to `RegisterView` and `LoginView` using `re.match(r"^[a-zA-Z0-9_.]+$")` to restrict input fields strictly to alphanumeric characters, underscores, and periods.
- **React Auto-Escaping**: Frontend renders properties inside standard `{}` text bindings which automatically escape HTML tags into text entities.

### Risk Mitigation
- Eliminates SQL Injection (SQLi), Cross-Site Scripting (XSS), and Command Injection attempts inside name inputs, passwords, or activity logs.

---

## 3. A04:2021 — Insecure Design

### Implementation
- **Rate-Limiting (Throttling)**: Implemented DRF throttle controls globally:
  - Anonymous/Unauthenticated Requests: Max 100 requests per day.
  - Authenticated User Requests: Max 1000 requests per day.

### Risk Mitigation
- Protects authorization forms and calculation endpoints against high-volume automated enumeration scans and denial-of-service (DoS) attempts.

---

## 4. A05:2021 — Security Misconfiguration

### Implementation
- **Hardened Cookies**: Set session cookies to be browser-invisible and secure:
  - `SESSION_COOKIE_HTTPONLY = True` (Blocks script-based access).
  - `SESSION_COOKIE_SECURE = True` / `CSRF_COOKIE_SECURE = True` (Requires HTTPS/SSL).
- **Security Headers**:
  - `X_FRAME_OPTIONS = "DENY"` (Prevents UI framing/Clickjacking).
  - `SECURE_CONTENT_TYPE_NOSNIFF = True` (Blocks MIME sniffing).
  - `SECURE_BROWSER_XSS_FILTER = True` (Forces reflective XSS block).

### Risk Mitigation
- Mitigates session hijacking, cross-site scripting session exfiltration, and UI spoofing vectors.

---

## 5. A07:2021 — Identification and Authentication Failures

### Implementation
- **Multi-Tier Account Locking**:
  - 3 failed attempts: Locks target account temporarily for **1 minute**.
  - 5 failed attempts: Locks account permanently (`is_locked_by_admin = True`) until manually reset.
- **Admin Unlock Portal**: Exposes an **Unlock** action trigger inside the User Management list to allow system administrators to reset locks.

### Risk Mitigation
- Neutralizes automated brute-force attacks and credential stuffing schemes.

---

## 6. A10:2021 — Server-Side Request Forgery (SSRF)

### Implementation
- **URL & Scheme Check**: Outbound calls in `llm_service.py` validate that input URIs use only `http` or `https` schemes.
- **DNS Lookup & Private Range Block**: Resolves destination hostnames to IP addresses before sending HTTP requests. Blocks connections if the destination resolves to:
  - Loopbacks (`127.0.0.1`, `[::1]`)
  - Local Private Subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)
  - Link-Local Address Space (`169.254.0.0/16`)
  - Multicast blocks

### Risk Mitigation
- Prevents attackers from abusing backend LLM completion requests to probe internal services, query local ports, or read sensitive cloud environment metadata.

---

## 7. A02:2021 — Cryptographic Failures

### Implementation
- **Password Hashing**: User passwords are encrypted using Django's default PBKDF2 hashing algorithm with SHA256 signatures (cost metrics managed natively).
- **Transport Layer Security**: All API client connections in production require SSL/TLS (HTTPS).

### Risk Mitigation
- Prevents database credential exposures and session packet interception.

---

## 8. A06:2021 — Vulnerable and Outdated Components

### Implementation
- **Regular Audit Checks**: Dependency audits run periodically (`npm audit` for Vite/React frontend and standard vulnerability checks for Python libraries).
- **Locked Versions**: Strict dependency pinning via locked manifest configurations (`package-lock.json`).

### Risk Mitigation
- Blocks attackers from exploiting known vulnerabilities in third-party framework dependencies.

---

## 9. A08:2021 — Software and Data Integrity Failures

### Implementation
- **CSV Format Validation**: Upload service validates file schemas, row lengths, data types, and structures before importing records.
- **Secure Registries**: Package installations are pulled from secure registries with integrity hash verification.

### Risk Mitigation
- Prevents ingestion of malicious or corrupt payloads designed to cause parsing exceptions.

---

## 10. A09:2021 — Security Logging and Monitoring Failures

### Implementation
- **Framework Log Routing**: System events and application logs are routed to Django standard loggers (`django.request` and system logs).
- **Activity History**: Security events (e.g. locks, unlocks) are registered cleanly on database records.

### Risk Mitigation
- Ensures audit trails exist to trace failed sessions or administrative changes.
