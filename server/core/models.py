from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class AccessPermission(models.Model):
    codename = models.CharField(max_length=80, unique=True)
    label = models.CharField(max_length=120)
    module = models.CharField(max_length=60)

    class Meta:
        ordering = ["module", "label"]

    def __str__(self):
        return self.label


class Role(models.Model):
    ADMIN = "admin"
    SECURITY_OFFICER = "security_officer"
    NORMAL_USER = "normal_user"

    ROLE_CHOICES = (
        (ADMIN, "Admin"),
        (SECURITY_OFFICER, "Security Officer"),
        (NORMAL_USER, "Normal User"),
    )

    name = models.CharField(max_length=60, unique=True)
    label = models.CharField(max_length=120, blank=True)
    description = models.TextField(blank=True)
    is_system = models.BooleanField(default=False)
    permissions = models.ManyToManyField(AccessPermission, blank=True, related_name="roles")

    def __str__(self):
        return self.display_name

    @property
    def display_name(self):
        if self.label:
            return self.label
        for value, text in self.ROLE_CHOICES:
            if value == self.name:
                return text
        return self.name.replace("_", " ").title()


class User(AbstractUser):
    role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True, blank=True)
    department = models.CharField(max_length=120, blank=True)
    job_title = models.CharField(max_length=120, blank=True)
    risk_score = models.PositiveIntegerField(default=0)
    is_high_risk = models.BooleanField(default=False)


class SensitiveFile(models.Model):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"
    SENSITIVITY_CHOICES = (
        (LOW, "Low"),
        (MEDIUM, "Medium"),
        (HIGH, "Confidential"),
        (CRITICAL, "Critical"),
    )

    name = models.CharField(max_length=180)
    path = models.CharField(max_length=500, unique=True)
    owner_department = models.CharField(max_length=120)
    allowed_roles = models.ManyToManyField(Role, blank=True)
    sensitivity = models.CharField(max_length=20, choices=SENSITIVITY_CHOICES, default=MEDIUM)
    requires_approval = models.BooleanField(default=False)
    document = models.OneToOneField(
        "Document",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sensitive_file",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class ActivityLog(models.Model):
    ACCESS = "access"
    DOWNLOAD = "download"
    UPLOAD = "upload"
    MODIFY = "modify"
    SHARE = "share"
    TRANSFER = "transfer"
    FAILED_ACCESS = "failed_access"
    ACTION_CHOICES = (
        (ACCESS, "File Access"),
        (DOWNLOAD, "File Download"),
        (UPLOAD, "File Upload"),
        (MODIFY, "Data Modification"),
        (SHARE, "Data Sharing"),
        (TRANSFER, "Transfer Attempt"),
        (FAILED_ACCESS, "Failed Access"),
    )

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"
    RISK_CHOICES = (
        (LOW, "Low"),
        (MEDIUM, "Medium"),
        (HIGH, "High"),
        (CRITICAL, "Critical"),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="activity_logs")
    file = models.ForeignKey(SensitiveFile, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=30, choices=ACTION_CHOICES)
    source_ip = models.GenericIPAddressField(null=True, blank=True)
    destination = models.CharField(max_length=255, blank=True)
    details = models.TextField(blank=True)
    risk_level = models.CharField(max_length=20, choices=RISK_CHOICES, default=LOW)
    blocked = models.BooleanField(default=False)
    requires_approval = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at"]


class DetectionRule(models.Model):
    name = models.CharField(max_length=160)
    description = models.TextField()
    is_active = models.BooleanField(default=True)
    severity = models.CharField(max_length=20, choices=ActivityLog.RISK_CHOICES, default=ActivityLog.MEDIUM)
    threshold = models.PositiveIntegerField(default=1)
    window_minutes = models.PositiveIntegerField(default=60)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Alert(models.Model):
    OPEN = "open"
    INVESTIGATING = "investigating"
    RESOLVED = "resolved"
    STATUS_CHOICES = (
        (OPEN, "Open"),
        (INVESTIGATING, "Investigating"),
        (RESOLVED, "Resolved"),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="alerts")
    activity_log = models.ForeignKey(ActivityLog, on_delete=models.CASCADE, related_name="alerts")
    rule = models.ForeignKey(DetectionRule, on_delete=models.SET_NULL, null=True, blank=True)
    title = models.CharField(max_length=180)
    message = models.TextField()
    severity = models.CharField(max_length=20, choices=ActivityLog.RISK_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=OPEN)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class IncidentReport(models.Model):
    title = models.CharField(max_length=180)
    summary = models.TextField()
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="created_reports")
    alerts = models.ManyToManyField(Alert, blank=True)
    risk_level = models.CharField(max_length=20, choices=ActivityLog.RISK_CHOICES, default=ActivityLog.MEDIUM)
    recommendation = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]


class DocumentCategory(models.Model):
    name = models.CharField(max_length=120, unique=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Document(models.Model):
    ACTIVE = "active"
    ARCHIVED = "archived"
    STATUS_CHOICES = (
        (ACTIVE, "Active"),
        (ARCHIVED, "Archived"),
    )

    title = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    category = models.ForeignKey(DocumentCategory, on_delete=models.PROTECT, related_name="documents")
    file = models.FileField(upload_to="documents/")
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="uploaded_documents")
    allowed_roles = models.ManyToManyField(Role, blank=True)
    sensitivity = models.CharField(max_length=20, choices=SensitiveFile.SENSITIVITY_CHOICES, default=SensitiveFile.MEDIUM)
    requires_approval = models.BooleanField(
        default=False,
        help_text="When enabled for critical documents, downloads need admin approval.",
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=ACTIVE)
    version = models.CharField(max_length=40, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    archived_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class DocumentAccessRequest(models.Model):
    VIEW = "view"
    DOWNLOAD = "download"
    ACTION_CHOICES = (
        (VIEW, "View"),
        (DOWNLOAD, "Download"),
    )
    PENDING = "pending"
    APPROVED = "approved"
    DENIED = "denied"
    STATUS_CHOICES = (
        (PENDING, "Pending"),
        (APPROVED, "Approved"),
        (DENIED, "Denied"),
    )

    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="access_requests")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="document_access_requests")
    action = models.CharField(max_length=20, choices=ACTION_CHOICES, default=DOWNLOAD)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=PENDING)
    note = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_document_access_requests",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]


class DocumentActivity(models.Model):
    UPLOAD = "upload"
    VIEW = "view"
    DOWNLOAD = "download"
    EDIT = "edit"
    ARCHIVE = "archive"
    DELETE = "delete"
    PERMISSION_CHANGE = "permission_change"
    ACTION_CHOICES = (
        (UPLOAD, "Upload Document"),
        (VIEW, "View Document"),
        (DOWNLOAD, "Download Document"),
        (EDIT, "Edit Document Details"),
        (ARCHIVE, "Archive Document"),
        (DELETE, "Delete Document"),
        (PERMISSION_CHANGE, "Access Permissions Changed"),
    )

    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="history")
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="document_activities")
    action = models.CharField(max_length=40, choices=ACTION_CHOICES)
    details = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
