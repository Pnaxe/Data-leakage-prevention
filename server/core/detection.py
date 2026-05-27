from datetime import time

from django.db.models import Count
from django.utils import timezone

from .models import ActivityLog, Alert, DetectionRule


RULES = {
    "too_many_downloads": {
        "name": "Too many downloads in a short time",
        "severity": ActivityLog.HIGH,
        "threshold": 5,
        "window_minutes": 15,
    },
    "outside_working_hours": {
        "name": "Accessing sensitive files outside working hours",
        "severity": ActivityLog.MEDIUM,
        "threshold": 1,
        "window_minutes": 60,
    },
    "repeated_failed_access": {
        "name": "Repeated failed access attempts",
        "severity": ActivityLog.HIGH,
        "threshold": 3,
        "window_minutes": 20,
    },
    "sensitive_transfer": {
        "name": "Uploading or transferring sensitive files",
        "severity": ActivityLog.CRITICAL,
        "threshold": 1,
        "window_minutes": 60,
    },
    "role_mismatch": {
        "name": "Accessing files not related to user role",
        "severity": ActivityLog.HIGH,
        "threshold": 1,
        "window_minutes": 60,
    },
    "unusual_activity": {
        "name": "Sudden unusual activity compared to normal behavior",
        "severity": ActivityLog.MEDIUM,
        "threshold": 10,
        "window_minutes": 60,
    },
}


def ensure_default_rules():
    for rule in RULES.values():
        DetectionRule.objects.get_or_create(
            name=rule["name"],
            defaults={
                "description": rule["name"],
                "severity": rule["severity"],
                "threshold": rule["threshold"],
                "window_minutes": rule["window_minutes"],
            },
        )


def evaluate_activity(activity):
    ensure_default_rules()
    alerts = []

    if activity.action == ActivityLog.DOWNLOAD:
        alerts.extend(_too_many_downloads(activity))

    if activity.file and activity.action in {ActivityLog.ACCESS, ActivityLog.DOWNLOAD}:
        alerts.extend(_outside_hours(activity))
        alerts.extend(_role_mismatch(activity))

    if activity.action == ActivityLog.FAILED_ACCESS:
        alerts.extend(_repeated_failed_access(activity))

    if activity.action in {ActivityLog.UPLOAD, ActivityLog.SHARE, ActivityLog.TRANSFER} and _is_sensitive(activity):
        alerts.append(_create_alert(activity, RULES["sensitive_transfer"]))
        activity.blocked = True
        activity.requires_approval = True

    alerts.extend(_unusual_activity(activity))

    if alerts:
        highest = _highest_severity([alert.severity for alert in alerts])
        activity.risk_level = highest
        activity.user.risk_score = min(100, activity.user.risk_score + _risk_points(highest))
        activity.user.is_high_risk = activity.user.risk_score >= 70
        activity.user.save(update_fields=["risk_score", "is_high_risk"])

    if activity.file and activity.file.requires_approval and activity.action in {ActivityLog.DOWNLOAD, ActivityLog.SHARE, ActivityLog.TRANSFER}:
        activity.requires_approval = True

    if activity.risk_level in {ActivityLog.HIGH, ActivityLog.CRITICAL} and activity.action == ActivityLog.DOWNLOAD:
        activity.blocked = True

    activity.save(update_fields=["risk_level", "blocked", "requires_approval"])
    return alerts


def _too_many_downloads(activity):
    rule = RULES["too_many_downloads"]
    since = timezone.now() - timezone.timedelta(minutes=rule["window_minutes"])
    count = ActivityLog.objects.filter(
        user=activity.user,
        action=ActivityLog.DOWNLOAD,
        created_at__gte=since,
    ).count()
    return [_create_alert(activity, rule)] if count >= rule["threshold"] else []


def _outside_hours(activity):
    current = timezone.localtime(activity.created_at).time()
    if current < time(8, 0) or current > time(17, 0):
        return [_create_alert(activity, RULES["outside_working_hours"])]
    return []


def _repeated_failed_access(activity):
    rule = RULES["repeated_failed_access"]
    since = timezone.now() - timezone.timedelta(minutes=rule["window_minutes"])
    count = ActivityLog.objects.filter(
        user=activity.user,
        action=ActivityLog.FAILED_ACCESS,
        created_at__gte=since,
    ).count()
    return [_create_alert(activity, rule)] if count >= rule["threshold"] else []


def _role_mismatch(activity):
    if not activity.file or not activity.user.role:
        return []
    if not activity.file.allowed_roles.exists():
        return []
    if not activity.file.allowed_roles.filter(id=activity.user.role_id).exists():
        activity.blocked = True
        return [_create_alert(activity, RULES["role_mismatch"])]
    return []


def _unusual_activity(activity):
    rule = RULES["unusual_activity"]
    since = timezone.now() - timezone.timedelta(minutes=rule["window_minutes"])
    recent_count = ActivityLog.objects.filter(user=activity.user, created_at__gte=since).count()
    daily_baseline = (
        ActivityLog.objects.filter(user=activity.user)
        .extra(select={"day": "date(created_at)"})
        .values("day")
        .annotate(total=Count("id"))
        .order_by("-day")[:7]
    )
    baseline_values = [row["total"] for row in daily_baseline]
    average = sum(baseline_values) / len(baseline_values) if baseline_values else rule["threshold"]
    if recent_count >= max(rule["threshold"], average * 2):
        return [_create_alert(activity, rule)]
    return []


def _is_sensitive(activity):
    return activity.file and activity.file.sensitivity in {ActivityLog.HIGH, ActivityLog.CRITICAL}


def _create_alert(activity, rule_data):
    rule = DetectionRule.objects.filter(name=rule_data["name"]).first()
    return Alert.objects.create(
        user=activity.user,
        activity_log=activity,
        rule=rule,
        title=rule_data["name"],
        message=f"{activity.user.username} triggered rule: {rule_data['name']}.",
        severity=rule_data["severity"],
    )


def _highest_severity(severities):
    order = [ActivityLog.LOW, ActivityLog.MEDIUM, ActivityLog.HIGH, ActivityLog.CRITICAL]
    return max(severities, key=order.index)


def _risk_points(severity):
    return {
        ActivityLog.LOW: 2,
        ActivityLog.MEDIUM: 8,
        ActivityLog.HIGH: 18,
        ActivityLog.CRITICAL: 30,
    }[severity]
