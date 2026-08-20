from django.db.models import Count
from django.http import FileResponse
from django.utils import timezone
from rest_framework import decorators, filters, parsers, permissions, status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .detection import evaluate_activity
from .document_access import (
    document_requires_download_approval,
    document_requires_reauth,
    documents_queryset_for_user,
    has_approved_download,
    issue_reauth_token,
    record_unauthorized_access,
    sync_sensitive_file_from_document,
    user_can_access_document,
    verify_reauth_token,
)
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
    is_privileged_user,
    scope_alerts_queryset,
)
from .serializers import (
    AccessPermissionSerializer,
    ActivityLogSerializer,
    AlertSerializer,
    DetectionRuleSerializer,
    DocumentAccessRequestSerializer,
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
    sensitive = getattr(document, "sensitive_file", None)
    activity = ActivityLog.objects.create(
        user=user,
        file=sensitive,
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

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.IsAuthenticated()]
        return [IsAdmin()]

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
    queryset = SensitiveFile.objects.select_related("document").prefetch_related("allowed_roles").all()
    serializer_class = SensitiveFileSerializer
    permission_classes = [IsAdminOrSecurityOfficer]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "path", "owner_department", "sensitivity", "document__title"]
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
    queryset = Document.objects.select_related(
        "category", "uploaded_by", "sensitive_file"
    ).prefetch_related("allowed_roles").all()
    serializer_class = DocumentSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["title", "description", "category__name", "sensitivity", "status"]
    ordering_fields = ["created_at", "updated_at", "title", "sensitivity"]

    def get_queryset(self):
        qs = documents_queryset_for_user(self.request.user, super().get_queryset())
        category = self.request.query_params.get("category")
        status_value = self.request.query_params.get("status")
        if category:
            qs = qs.filter(category_id=category)
        if status_value:
            qs = qs.filter(status=status_value)
        return qs

    def _load_document(self, pk):
        return Document.objects.select_related(
            "category", "uploaded_by", "sensitive_file"
        ).prefetch_related("allowed_roles").filter(pk=pk).first()

    def _deny_unauthorized(self, request, document, action):
        record_unauthorized_access(
            user=request.user,
            document=document,
            action=action,
            details=(
                f"Unauthorized {action} attempt on document \"{document.title}\" "
                f"by {request.user.username}."
            ),
        )
        return Response(
            {
                "detail": "You are not authorized to access this document.",
                "code": "unauthorized_document",
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    def _ensure_reauth(self, request, document):
        if not document_requires_reauth(document):
            return None
        token = request.headers.get("X-Document-Reauth") or request.query_params.get("reauth_token")
        if verify_reauth_token(request.user, document, token):
            return None
        return Response(
            {
                "detail": "Critical documents require password re-authentication.",
                "code": "reauth_required",
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    def _ensure_download_approval(self, request, document):
        if not document_requires_download_approval(document):
            return None
        if is_privileged_user(request.user):
            return None
        if has_approved_download(request.user, document):
            return None
        pending = DocumentAccessRequest.objects.filter(
            document=document,
            user=request.user,
            action=DocumentAccessRequest.DOWNLOAD,
            status=DocumentAccessRequest.PENDING,
        ).exists()
        return Response(
            {
                "detail": "Critical download requires admin approval.",
                "code": "approval_required",
                "pending": pending,
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    def perform_create(self, serializer):
        document = serializer.save(uploaded_by=self.request.user)
        if document.sensitivity == SensitiveFile.CRITICAL and "requires_approval" not in serializer.validated_data:
            document.requires_approval = True
            document.save(update_fields=["requires_approval"])
        sync_sensitive_file_from_document(document)
        record_document_activity(
            document=document,
            user=self.request.user,
            action=DocumentActivity.UPLOAD,
            details="Document uploaded to repository.",
        )

    def retrieve(self, request, *args, **kwargs):
        document = self._load_document(kwargs.get("pk"))
        if not document:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if not user_can_access_document(request.user, document):
            return self._deny_unauthorized(request, document, "view")
        reauth_error = self._ensure_reauth(request, document)
        if reauth_error:
            return reauth_error
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
        sync_sensitive_file_from_document(document)
        record_document_activity(
            document=document,
            user=self.request.user,
            action=DocumentActivity.EDIT,
            details="Document details or permissions updated.",
        )

    def perform_destroy(self, instance):
        if not is_privileged_user(self.request.user) and instance.uploaded_by_id != self.request.user.id:
            raise PermissionDenied("Only admins or the uploader can delete this document.")
        record_document_activity(
            document=instance,
            user=self.request.user,
            action=DocumentActivity.DELETE,
            details="Document permanently deleted.",
        )
        instance.delete()

    @decorators.action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        document = self._load_document(pk)
        if not document:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if not is_privileged_user(request.user) and document.uploaded_by_id != request.user.id:
            return self._deny_unauthorized(request, document, "archive")
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
        document = self._load_document(pk)
        if not document:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if not user_can_access_document(request.user, document):
            return self._deny_unauthorized(request, document, "download")
        approval_error = self._ensure_download_approval(request, document)
        if approval_error:
            return approval_error
        reauth_error = self._ensure_reauth(request, document)
        if reauth_error:
            return reauth_error
        if not document.file:
            return Response({"detail": "No file attached."}, status=status.HTTP_404_NOT_FOUND)
        record_document_activity(
            document=document,
            user=request.user,
            action=DocumentActivity.DOWNLOAD,
            details="Document downloaded.",
        )
        return FileResponse(
            document.file.open("rb"),
            as_attachment=True,
            filename=document.file.name.split("/")[-1],
        )

    @decorators.action(detail=True, methods=["post"], url_path="reauthenticate")
    def reauthenticate(self, request, pk=None):
        document = self._load_document(pk)
        if not document:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if not user_can_access_document(request.user, document):
            return self._deny_unauthorized(request, document, "reauthenticate")
        password = request.data.get("password", "")
        if not request.user.check_password(password):
            return Response(
                {"detail": "Incorrect password.", "code": "invalid_password"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        token = issue_reauth_token(request.user, document)
        return Response({"reauth_token": token, "expires_in": 300})

    @decorators.action(detail=True, methods=["post"], url_path="request-download-approval")
    def request_download_approval(self, request, pk=None):
        document = self._load_document(pk)
        if not document:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if not user_can_access_document(request.user, document):
            return self._deny_unauthorized(request, document, "request_approval")
        if not document_requires_download_approval(document):
            return Response({"detail": "Approval is not required for this document."}, status=400)
        existing = DocumentAccessRequest.objects.filter(
            document=document,
            user=request.user,
            action=DocumentAccessRequest.DOWNLOAD,
            status__in=[DocumentAccessRequest.PENDING, DocumentAccessRequest.APPROVED],
        ).first()
        if existing:
            return Response(DocumentAccessRequestSerializer(existing).data)
        access_request = DocumentAccessRequest.objects.create(
            document=document,
            user=request.user,
            action=DocumentAccessRequest.DOWNLOAD,
            note=request.data.get("note", ""),
        )
        return Response(DocumentAccessRequestSerializer(access_request).data, status=status.HTTP_201_CREATED)


class DocumentAccessRequestViewSet(viewsets.ModelViewSet):
    queryset = DocumentAccessRequest.objects.select_related(
        "document", "user", "reviewed_by"
    ).all()
    serializer_class = DocumentAccessRequestSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["document__title", "user__username", "status", "note"]
    ordering_fields = ["created_at", "status"]

    def get_permissions(self):
        if self.action in ("list", "retrieve", "create"):
            return [permissions.IsAuthenticated()]
        return [IsAdminOrSecurityOfficer()]

    def get_queryset(self):
        qs = super().get_queryset()
        if is_privileged_user(self.request.user):
            return qs
        return qs.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user, action=DocumentAccessRequest.DOWNLOAD)

    @decorators.action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        access_request = self.get_object()
        access_request.status = DocumentAccessRequest.APPROVED
        access_request.reviewed_by = request.user
        access_request.reviewed_at = timezone.now()
        access_request.note = request.data.get("note", access_request.note)
        access_request.save()
        return Response(self.get_serializer(access_request).data)

    @decorators.action(detail=True, methods=["post"])
    def deny(self, request, pk=None):
        access_request = self.get_object()
        access_request.status = DocumentAccessRequest.DENIED
        access_request.reviewed_by = request.user
        access_request.reviewed_at = timezone.now()
        access_request.note = request.data.get("note", access_request.note)
        access_request.save()
        return Response(self.get_serializer(access_request).data)


class DocumentActivityViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = DocumentActivity.objects.select_related("document", "user").all()
    serializer_class = DocumentActivitySerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["document__title", "user__username", "action", "details"]
    ordering_fields = ["created_at", "action"]

    def get_queryset(self):
        qs = super().get_queryset()
        if not is_privileged_user(self.request.user):
            qs = qs.filter(user=self.request.user)
        document = self.request.query_params.get("document")
        if document:
            qs = qs.filter(document_id=document)
        return qs
