"""Document RBAC, re-authentication, approval, Sensitive Files sync, and notifications."""

from __future__ import annotations

import secrets
import uuid

from django.conf import settings
from django.core.cache import cache
from django.core.mail import send_mail
from django.db.models import Q

from .detection import ensure_default_rules
from .models import ActivityLog, Alert, DetectionRule, Document, DocumentAccessRequest, Role, SensitiveFile
from .permissions import get_user_role_name, is_privileged_user

SENSITIVE_LEVELS = {SensitiveFile.HIGH, SensitiveFile.CRITICAL}
REAUTH_TTL_SECONDS = 5 * 60
UNAUTHORIZED_RULE_NAME = "Unauthorized document access attempt"


def user_can_access_document(user, document) -> bool:
    if not user or not user.is_authenticated:
        return False
    if is_privileged_user(user):
        return True
    if document.uploaded_by_id == user.id:
        return True
    role_ids = list(document.allowed_roles.values_list("id", flat=True))
    # No roles assigned = restricted / admin-managed only.
    if not role_ids:
        return False
    user_role_id = getattr(user, "role_id", None)
    return bool(user_role_id and user_role_id in role_ids)


def documents_queryset_for_user(user, queryset=None):
    qs = queryset if queryset is not None else Document.objects.all()
    if is_privileged_user(user):
        return qs
    role_id = getattr(user, "role_id", None)
    filters = Q(uploaded_by=user)
    if role_id:
        filters |= Q(allowed_roles__id=role_id)
    return qs.filter(filters).distinct()


def document_requires_reauth(document) -> bool:
    return document.sensitivity == SensitiveFile.CRITICAL


def document_requires_download_approval(document) -> bool:
    return bool(document.requires_approval and document.sensitivity == SensitiveFile.CRITICAL)


def has_approved_download(user, document) -> bool:
    return DocumentAccessRequest.objects.filter(
        document=document,
        user=user,
        action=DocumentAccessRequest.DOWNLOAD,
        status=DocumentAccessRequest.APPROVED,
    ).exists()


def issue_reauth_token(user, document) -> str:
    token = secrets.token_urlsafe(24)
    cache.set(
        f"doc_reauth:{user.id}:{document.id}:{token}",
        True,
        timeout=REAUTH_TTL_SECONDS,
    )
    return token


def verify_reauth_token(user, document, token: str | None) -> bool:
    if not token:
        return False
    key = f"doc_reauth:{user.id}:{document.id}:{token}"
    return bool(cache.get(key))


def sync_sensitive_file_from_document(document: Document) -> SensitiveFile | None:
    """Register/update Sensitive Files when a document is Confidential (high) or Critical."""
    if document.sensitivity not in SENSITIVE_LEVELS:
        linked = getattr(document, "sensitive_file", None)
        if linked:
            # Keep the register entry but mark as linked; do not delete history.
            linked.sensitivity = document.sensitivity
            linked.requires_approval = document.requires_approval
            linked.save(update_fields=["sensitivity", "requires_approval"])
            linked.allowed_roles.set(document.allowed_roles.all())
        return linked

    path = document.file.name if document.file else f"documents/doc-{document.id}"
    path = path[:500]
    department = ""
    if document.uploaded_by_id:
        department = document.uploaded_by.department or document.uploaded_by.username

    sensitive, _ = SensitiveFile.objects.update_or_create(
        document=document,
        defaults={
            "name": document.title[:180],
            "path": path,
            "owner_department": department or "Document Repository",
            "sensitivity": document.sensitivity,
            "requires_approval": document.requires_approval
            or document.sensitivity == SensitiveFile.CRITICAL,
        },
    )
    # Ensure unique path if another row owns it without a document link.
    if SensitiveFile.objects.filter(path=path).exclude(pk=sensitive.pk).exists():
        sensitive.path = f"{path}#doc-{document.id}-{uuid.uuid4().hex[:8]}"[:500]
        sensitive.save(update_fields=["path"])

    sensitive.allowed_roles.set(document.allowed_roles.all())
    return sensitive


def ensure_unauthorized_rule():
    ensure_default_rules()
    DetectionRule.objects.get_or_create(
        name=UNAUTHORIZED_RULE_NAME,
        defaults={
            "description": "User attempted to open or download a document they are not authorized to access.",
            "severity": ActivityLog.HIGH,
            "threshold": 1,
            "window_minutes": 60,
            "is_active": True,
        },
    )


def record_unauthorized_access(*, user, document, action: str, details: str):
    ensure_unauthorized_rule()
    sensitive = getattr(document, "sensitive_file", None)
    activity = ActivityLog.objects.create(
        user=user,
        file=sensitive,
        action=ActivityLog.FAILED_ACCESS,
        details=details,
        risk_level=ActivityLog.HIGH,
        blocked=True,
    )
    rule = DetectionRule.objects.filter(name=UNAUTHORIZED_RULE_NAME).first()
    alert = Alert.objects.create(
        user=user,
        activity_log=activity,
        rule=rule,
        title=UNAUTHORIZED_RULE_NAME,
        message=(
            f"{user.username} attempted unauthorized {action} on document "
            f"\"{document.title}\" (sensitivity: {document.sensitivity})."
        ),
        severity=ActivityLog.HIGH,
    )
    notify_admins_of_unauthorized_access(user=user, document=document, action=action, alert=alert)
    if user and hasattr(user, "risk_score"):
        user.risk_score = min(100, user.risk_score + 18)
        user.is_high_risk = user.risk_score >= 70
        user.save(update_fields=["risk_score", "is_high_risk"])
    return activity, alert


def notify_admins_of_unauthorized_access(*, user, document, action, alert):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    admin_emails = list(
        User.objects.filter(Q(is_superuser=True) | Q(role__name=Role.ADMIN))
        .exclude(email="")
        .values_list("email", flat=True)
        .distinct()
    )
    fallback = getattr(settings, "ADMIN_ALERT_EMAIL", "") or ""
    if fallback and fallback not in admin_emails:
        admin_emails.append(fallback)
    if not admin_emails:
        return

    subject = f"[DLP Alert] Unauthorized {action}: {document.title}"
    body = (
        f"Unauthorized document access detected.\n\n"
        f"User: {user.username}\n"
        f"Role: {get_user_role_name(user) or 'none'}\n"
        f"Action: {action}\n"
        f"Document: {document.title}\n"
        f"Sensitivity: {document.sensitivity}\n"
        f"Alert ID: {alert.id}\n"
        f"Time: {alert.created_at}\n"
    )
    try:
        send_mail(
            subject,
            body,
            getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@localhost"),
            admin_emails,
            fail_silently=True,
        )
    except Exception:
        pass
