from rest_framework.permissions import BasePermission

from .models import Role


def get_user_role_name(user):
    return getattr(getattr(user, "role", None), "name", None)


def is_privileged_user(user):
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser or user.is_staff:
        return True
    return get_user_role_name(user) in {Role.ADMIN, Role.SECURITY_OFFICER}


def can_view_all_users(user):
    if not user or not user.is_authenticated:
        return False
    if is_privileged_user(user):
        return True
    return user_has_permission(user, "manage_users")


def can_list_users(user):
    if can_view_all_users(user):
        return True
    return user_has_permission(user, "view_dashboard") or user_has_permission(
        user, "view_activity_logs"
    )


def can_list_alerts(user):
    if not user or not user.is_authenticated:
        return False
    if is_privileged_user(user):
        return True
    return (
        user_has_permission(user, "manage_alerts")
        or user_has_permission(user, "manage_sensitive_files")
        or user_has_permission(user, "manage_reports")
        or user_has_permission(user, "manage_settings")
        or user_has_permission(user, "view_dashboard")
    )


def scope_alerts_queryset(user, queryset):
    if is_privileged_user(user) or user_has_permission(user, "manage_alerts"):
        return queryset
    return queryset.filter(user=user)


def user_has_permission(user, codename):
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    role = getattr(user, "role", None)
    if not role:
        return False
    if role.name == Role.ADMIN:
        return True
    return role.permissions.filter(codename=codename).exists()


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.user.is_superuser or request.user.is_staff:
            return True
        return get_user_role_name(request.user) == Role.ADMIN or user_has_permission(
            request.user, "manage_users"
        )


class IsAdminOrSecurityOfficer(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.user.is_superuser or request.user.is_staff:
            return True
        role_name = get_user_role_name(request.user)
        if role_name in {Role.ADMIN, Role.SECURITY_OFFICER}:
            return True
        return (
            user_has_permission(request.user, "manage_sensitive_files")
            or user_has_permission(request.user, "manage_alerts")
            or user_has_permission(request.user, "manage_reports")
            or user_has_permission(request.user, "manage_settings")
        )


class HasViewActivityLogs(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if is_privileged_user(request.user):
            return True
        return user_has_permission(request.user, "view_activity_logs")


class CanListUsers(BasePermission):
    def has_permission(self, request, view):
        return can_list_users(request.user)


class CanListAlerts(BasePermission):
    def has_permission(self, request, view):
        return can_list_alerts(request.user)
