"""Application permission definitions and default role assignments."""

PERMISSION_DEFINITIONS = [
    ("manage_users", "Manage users", "Access Control"),
    ("manage_roles", "Manage roles & permissions", "Access Control"),
    ("view_dashboard", "View dashboard", "General"),
    ("view_activity_logs", "View activity logs", "Monitoring"),
    ("manage_sensitive_files", "Manage sensitive files", "Protection"),
    ("manage_documents", "Manage document repository", "Protection"),
    ("manage_alerts", "Manage alerts", "Response"),
    ("manage_reports", "Manage incident reports", "Response"),
    ("manage_settings", "Manage system configuration", "System"),
]

ROLE_DEFAULT_PERMISSIONS = {
    "admin": [codename for codename, _, _ in PERMISSION_DEFINITIONS],
    "security_officer": [
        "view_dashboard",
        "view_activity_logs",
        "manage_sensitive_files",
        "manage_documents",
        "manage_alerts",
        "manage_reports",
    ],
    "normal_user": [
        "view_dashboard",
        "view_activity_logs",
        "manage_documents",
    ],
}

ROLE_LABELS = {
    "admin": "Admin",
    "security_officer": "Security Officer",
    "normal_user": "Normal User",
}


def ensure_permissions_and_role_defaults():
    from .models import AccessPermission, Role

    permission_map = {}
    for codename, label, module in PERMISSION_DEFINITIONS:
        permission, _ = AccessPermission.objects.update_or_create(
            codename=codename,
            defaults={"label": label, "module": module},
        )
        permission_map[codename] = permission

    for role_name, codenames in ROLE_DEFAULT_PERMISSIONS.items():
        role, _ = Role.objects.get_or_create(
            name=role_name,
            defaults={
                "label": ROLE_LABELS.get(role_name, role_name.replace("_", " ").title()),
                "is_system": True,
            },
        )
        role.label = ROLE_LABELS.get(role_name, role.label)
        role.is_system = True
        role.save(update_fields=["label", "is_system"])
        role.permissions.set([permission_map[c] for c in codenames if c in permission_map])
