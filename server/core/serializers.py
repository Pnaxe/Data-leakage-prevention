from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import (
    AccessPermission,
    ActivityLog,
    Alert,
    DetectionRule,
    Document,
    DocumentAccessRequest,
    DocumentActivity,
    DocumentCategory,
    IncidentReport,
    Role,
    SensitiveFile,
)


User = get_user_model()


class AccessPermissionSerializer(serializers.ModelSerializer):
    assigned_roles = serializers.SerializerMethodField()

    class Meta:
        model = AccessPermission
        fields = ["id", "codename", "label", "module", "assigned_roles"]

    def get_assigned_roles(self, obj):
        labels = []
        for role in obj.roles.all():
            labels.append(role.label or role.name.replace("_", " ").title())
        return labels


class RoleSerializer(serializers.ModelSerializer):
    permission_ids = serializers.PrimaryKeyRelatedField(
        queryset=AccessPermission.objects.all(),
        source="permissions",
        many=True,
        required=False,
    )
    permission_codenames = serializers.SerializerMethodField()
    permission_labels = serializers.SerializerMethodField()
    user_count = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = [
            "id",
            "name",
            "label",
            "description",
            "is_system",
            "permission_ids",
            "permission_codenames",
            "permission_labels",
            "user_count",
        ]
        read_only_fields = ["is_system"]

    def get_permission_codenames(self, obj):
        return list(obj.permissions.values_list("codename", flat=True))

    def get_permission_labels(self, obj):
        return list(obj.permissions.values_list("label", flat=True))

    def get_user_count(self, obj):
        count = getattr(obj, "user_count", None)
        if count is not None:
            return count
        return obj.user_set.count()

    def validate_name(self, value):
        slug = value.strip().lower().replace(" ", "_")
        if not slug.replace("_", "").isalnum():
            raise serializers.ValidationError("Use letters, numbers, and underscores only.")
        return slug

    def create(self, validated_data):
        permissions = validated_data.pop("permissions", [])
        if not validated_data.get("label"):
            validated_data["label"] = validated_data["name"].replace("_", " ").title()
        role = Role.objects.create(**validated_data)
        role.permissions.set(permissions)
        return role

    def update(self, instance, validated_data):
        permissions = validated_data.pop("permissions", None)
        if instance.is_system:
            validated_data.pop("name", None)
        role = super().update(instance, validated_data)
        if permissions is not None:
            role.permissions.set(permissions)
        return role


def get_permission_codenames_for_user(user):
    role = getattr(user, "role", None)
    if not role:
        return []
    if role.name == Role.ADMIN or user.is_superuser:
        return list(AccessPermission.objects.values_list("codename", flat=True))
    return list(role.permissions.values_list("codename", flat=True))


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)
    role_name = serializers.CharField(source="role.name", read_only=True)
    role_label = serializers.CharField(source="role.display_name", read_only=True)
    permission_codenames = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "password",
            "role",
            "role_name",
            "role_label",
            "permission_codenames",
            "department",
            "job_title",
            "risk_score",
            "is_high_risk",
            "is_active",
            "is_staff",
            "is_superuser",
        ]
        read_only_fields = ["is_staff", "is_superuser"]

    def get_permission_codenames(self, obj):
        return get_permission_codenames_for_user(obj)

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class SensitiveFileSerializer(serializers.ModelSerializer):
    allowed_role_names = serializers.SerializerMethodField()
    document_title = serializers.CharField(source="document.title", read_only=True, allow_null=True)
    source = serializers.SerializerMethodField()

    class Meta:
        model = SensitiveFile
        fields = "__all__"

    def get_allowed_role_names(self, obj):
        return [role.display_name for role in obj.allowed_roles.all()]

    def get_source(self, obj):
        return "document_repository" if obj.document_id else "manual"


class ActivityLogSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    file_name = serializers.CharField(source="file.name", read_only=True)

    class Meta:
        model = ActivityLog
        fields = "__all__"
        read_only_fields = ["risk_level", "blocked", "requires_approval"]
        extra_kwargs = {
            "user": {"required": False},
            "file": {"required": False, "allow_null": True},
        }


class DetectionRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = DetectionRule
        fields = "__all__"


class AlertSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    rule_name = serializers.CharField(source="rule.name", read_only=True)

    class Meta:
        model = Alert
        fields = "__all__"


class IncidentReportSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)
    alerts_count = serializers.SerializerMethodField()

    class Meta:
        model = IncidentReport
        fields = "__all__"
        read_only_fields = ["created_by"]

    def get_alerts_count(self, obj):
        return obj.alerts.count()


class DocumentCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentCategory
        fields = "__all__"


class DocumentSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    uploaded_by_username = serializers.CharField(source="uploaded_by.username", read_only=True)
    allowed_role_names = serializers.SerializerMethodField()
    file_name = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()
    requires_reauth = serializers.SerializerMethodField()
    download_approval_status = serializers.SerializerMethodField()
    sensitive_file_id = serializers.IntegerField(source="sensitive_file.id", read_only=True, allow_null=True)

    class Meta:
        model = Document
        fields = "__all__"
        read_only_fields = ["uploaded_by", "status", "archived_at"]
        extra_kwargs = {
            "file": {"write_only": True, "required": False},
        }

    def get_allowed_role_names(self, obj):
        return [role.display_name for role in obj.allowed_roles.all()]

    def get_file_name(self, obj):
        return obj.file.name.split("/")[-1] if obj.file else ""

    def get_file_url(self, obj):
        # Never expose direct media URLs for restricted/critical docs.
        return ""

    def get_requires_reauth(self, obj):
        return obj.sensitivity == SensitiveFile.CRITICAL

    def get_download_approval_status(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        if not (obj.requires_approval and obj.sensitivity == SensitiveFile.CRITICAL):
            return "not_required"
        latest = (
            obj.access_requests.filter(user=request.user, action="download")
            .order_by("-created_at")
            .first()
        )
        return latest.status if latest else "none"


class DocumentAccessRequestSerializer(serializers.ModelSerializer):
    document_title = serializers.CharField(source="document.title", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    reviewed_by_username = serializers.CharField(source="reviewed_by.username", read_only=True, allow_null=True)

    class Meta:
        model = DocumentAccessRequest
        fields = "__all__"
        read_only_fields = ["user", "status", "reviewed_by", "reviewed_at"]


class DocumentActivitySerializer(serializers.ModelSerializer):
    document_title = serializers.CharField(source="document.title", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = DocumentActivity
        fields = "__all__"


class LoginSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role.name if user.role else ""
        token["username"] = user.username
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data
