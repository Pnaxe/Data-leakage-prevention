from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import (
    AccessPermission,
    ActivityLog,
    Alert,
    DetectionRule,
    Document,
    DocumentActivity,
    DocumentCategory,
    IncidentReport,
    Role,
    SensitiveFile,
    User,
)


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ("Organization", {"fields": ("role", "department", "job_title", "risk_score", "is_high_risk")}),
    )
    list_display = ("username", "email", "role", "department", "risk_score", "is_high_risk", "is_active")


admin.site.register(AccessPermission)
admin.site.register(Role)
admin.site.register(SensitiveFile)
admin.site.register(ActivityLog)
admin.site.register(DetectionRule)
admin.site.register(Alert)
admin.site.register(IncidentReport)
admin.site.register(DocumentCategory)
admin.site.register(Document)
admin.site.register(DocumentActivity)
