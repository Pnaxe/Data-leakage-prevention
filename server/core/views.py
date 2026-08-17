from django.db.models import Count
from django.http import FileResponse
from django.utils import timezone
from rest_framework import decorators, filters, parsers, permissions, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .detection import evaluate_activity
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
from .permissions import (
    CanListAlerts,
    CanListUsers,
    HasViewActivityLogs,
    IsAdmin,
    IsAdminOrSecurityOfficer,
    can_view_all_users,
    get_user_role_name,
    scope_alerts_queryset,
)
from .serializers import (
    AccessPermissionSerializer,
    ActivityLogSerializer,
    AlertSerializer,
    DetectionRuleSerializer,
    DocumentActivitySerializer,
    DocumentCategorySerializer,
    DocumentSerializer,
    IncidentReportSerializer,
    LoginSerializer,
    RoleSerializer,
    SensitiveFileSerializer,
    UserSerializer,
)


DOCUMENT_ACTIVITY_TO_LOG_ACTION = {
    DocumentActivity.UPLOAD: ActivityLog.UPLOAD,
    DocumentActivity.VIEW: ActivityLog.ACCESS,
    DocumentActivity.DOWNLOAD: ActivityLog.DOWNLOAD,
    DocumentActivity.EDIT: ActivityLog.MODIFY,
    DocumentActivity.ARCHIVE: ActivityLog.MODIFY,
    DocumentActivity.DELETE: ActivityLog.MODIFY,
}


def record_document_activity(*, document, user, action, details):
    DocumentActivity.objects.create(
        document=document,
        user=user,
        action=action,
        details=details,
    )
    log_action = DOCUMENT_ACTIVITY_TO_LOG_ACTION.get(action)
    if not log_action:
        return
    activity = ActivityLog.objects.create(
        user=user,
        action=log_action,
        details=f"{details} Document: {document.title}.",
    )
    evaluate_activity(activity)


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer
    permission_classes = [permissions.AllowAny]


class MeView(APIView):
    def get(self, request):
        user = User.objects.select_related("role").prefetch_related("role__permissions").get(
            pk=request.user.pk
        )
        return Response(UserSerializer(user).data)


class AccessPermissionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AccessPermission.objects.all()
    serializer_class = AccessPermissionSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        return AccessPermission.objects.prefetch_related("roles").all()


class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        return Role.objects.prefetch_related("permissions").annotate(user_count=Count("user"))

    def destroy(self, request, *args, **kwargs):
        role = self.get_object()
        if role.is_system:
            return Response({"detail": "System roles cannot be deleted."}, status=400)
        if role.user_set.exists():
            return Response(
                {"detail": "Reassign or remove users with this role before deleting it."},
                status=400,
            )
        return super().destroy(request, *args, **kwargs)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related("role").all()
    serializer_class = UserSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["username", "email", "department", "role__name"]

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [CanListUsers()]
        return [IsAdmin()]

    def get_queryset(self):
        qs = super().get_queryset()
        if can_view_all_users(self.request.user):
            return qs
        return qs.filter(pk=self.request.user.pk)


class SensitiveFileViewSet(viewsets.ModelViewSet):
    queryset = SensitiveFile.objects.prefetch_related("allowed_roles").all()
    serializer_class = SensitiveFileSerializer
    permission_classes = [IsAdminOrSecurityOfficer]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "path", "owner_department", "sensitivity"]
    ordering_fields = ["created_at", "sensitivity", "name"]


class ActivityLogViewSet(viewsets.ModelViewSet):
    queryset = ActivityLog.objects.select_related("user", "file").all()
    serializer_class = ActivityLogSerializer
    permission_classes = [HasViewActivityLogs]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["user__username", "file__name", "action", "risk_level", "source_ip"]
    ordering_fields = ["created_at", "risk_level", "action"]

    def get_queryset(self):
        qs = super().get_queryset()
        role = get_user_role_name(self.request.user)
        if role == Role.NORMAL_USER:
            qs = qs.filter(user=self.request.user)
        user = self.request.query_params.get("user")
        action = self.request.query_params.get("action")
        risk = self.request.query_params.get("risk_level")
        start = self.request.query_params.get("start")
        end = self.request.query_params.get("end")
        if user:
            qs = qs.filter(user_id=user)
        if action:
            qs = qs.filter(action=action)
        if risk:
            qs = qs.filter(risk_level=risk)
        if start:
            qs = qs.filter(created_at__date__gte=start)
        if end:
            qs = qs.filter(created_at__date__lte=end)
        return qs

    def perform_create(self, serializer):
        role = get_user_role_name(self.request.user)
        selected_user = serializer.validated_data.get("user")
        if role == Role.NORMAL_USER or not selected_user:
            activity = serializer.save(user=self.request.user)
        else:
            activity = serializer.save()
        evaluate_activity(activity)


class DetectionRuleViewSet(viewsets.ModelViewSet):
    queryset = DetectionRule.objects.all()
    serializer_class = DetectionRuleSerializer
    permission_classes = [IsAdmin]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "description", "severity"]
    ordering_fields = ["name", "severity", "threshold", "created_at"]


class AlertViewSet(viewsets.ModelViewSet):
    queryset = Alert.objects.select_related("user", "activity_log", "rule").all()
    serializer_class = AlertSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["user__username", "title", "severity", "status"]
    ordering_fields = ["created_at", "severity", "status"]

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [CanListAlerts()]
        return [IsAdminOrSecurityOfficer()]

    def get_queryset(self):
        qs = scope_alerts_queryset(self.request.user, super().get_queryset())
        severity = self.request.query_params.get("severity")
        status = self.request.query_params.get("status")
        if severity:
            qs = qs.filter(severity=severity)
        if status:
            qs = qs.filter(status=status)
        return qs


class IncidentReportViewSet(viewsets.ModelViewSet):
    queryset = IncidentReport.objects.prefetch_related("alerts").select_related("created_by").all()
    serializer_class = IncidentReportSerializer
    permission_classes = [IsAdminOrSecurityOfficer]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["title", "summary", "risk_level"]
    ordering_fields = ["created_at", "risk_level"]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class DocumentCategoryViewSet(viewsets.ModelViewSet):
    queryset = DocumentCategory.objects.all()
    serializer_class = DocumentCategorySerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "description"]


class DocumentViewSet(viewsets.ModelViewSet):
    queryset = Document.objects.select_related("category", "uploaded_by").prefetch_related("allowed_roles").all()
    serializer_class = DocumentSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["title", "description", "category__name", "sensitivity", "status"]
    ordering_fields = ["created_at", "updated_at", "title", "sensitivity"]

    def get_queryset(self):
        qs = super().get_queryset()
        category = self.request.query_params.get("category")
        status = self.request.query_params.get("status")
        if category:
            qs = qs.filter(category_id=category)
        if status:
            qs = qs.filter(status=status)
        return qs

    def perform_create(self, serializer):
        document = serializer.save(uploaded_by=self.request.user)
        record_document_activity(
            document=document,
            user=self.request.user,
            action=DocumentActivity.UPLOAD,
            details="Document uploaded to repository.",
        )

    def retrieve(self, request, *args, **kwargs):
        document = self.get_object()
        record_document_activity(
            document=document,
            user=request.user,
            action=DocumentActivity.VIEW,
            details="Document details viewed.",
        )
        serializer = self.get_serializer(document)
        return Response(serializer.data)

    def perform_update(self, serializer):
        document = serializer.save()
        record_document_activity(
            document=document,
            user=self.request.user,
            action=DocumentActivity.EDIT,
            details="Document details or permissions updated.",
        )

    def perform_destroy(self, instance):
        record_document_activity(
            document=instance,
            user=self.request.user,
            action=DocumentActivity.DELETE,
            details="Document permanently deleted.",
        )
        instance.delete()

    @decorators.action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        document = self.get_object()
        document.status = Document.ARCHIVED
        document.archived_at = timezone.now()
        document.save(update_fields=["status", "archived_at", "updated_at"])
        record_document_activity(
            document=document,
            user=request.user,
            action=DocumentActivity.ARCHIVE,
            details="Document archived.",
        )
        return Response(self.get_serializer(document).data)

    @decorators.action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        document = self.get_object()
        record_document_activity(
            document=document,
            user=request.user,
            action=DocumentActivity.DOWNLOAD,
            details="Document downloaded.",
        )
        return FileResponse(document.file.open("rb"), as_attachment=True, filename=document.file.name.split("/")[-1])


class DocumentActivityViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = DocumentActivity.objects.select_related("document", "user").all()
    serializer_class = DocumentActivitySerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["document__title", "user__username", "action", "details"]
    ordering_fields = ["created_at", "action"]

    def get_queryset(self):
        qs = super().get_queryset()
        document = self.request.query_params.get("document")
        if document:
            qs = qs.filter(document_id=document)
        return qs
