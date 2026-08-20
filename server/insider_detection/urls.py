from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from core.views import (
    AccessPermissionViewSet,
    ActivityLogViewSet,
    AlertViewSet,
    DetectionRuleViewSet,
    DocumentAccessRequestViewSet,
    DocumentActivityViewSet,
    DocumentCategoryViewSet,
    DocumentViewSet,
    IncidentReportViewSet,
    LoginView,
    MeView,
    RoleViewSet,
    SensitiveFileViewSet,
    UserViewSet,
)

router = DefaultRouter()
router.register("permissions", AccessPermissionViewSet)
router.register("roles", RoleViewSet)
router.register("users", UserViewSet)
router.register("sensitive-files", SensitiveFileViewSet)
router.register("activity-logs", ActivityLogViewSet)
router.register("detection-rules", DetectionRuleViewSet)
router.register("alerts", AlertViewSet)
router.register("reports", IncidentReportViewSet)
router.register("document-categories", DocumentCategoryViewSet)
router.register("documents", DocumentViewSet)
router.register("document-activity", DocumentActivityViewSet)
router.register("document-access-requests", DocumentAccessRequestViewSet)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/login/", LoginView.as_view(), name="token_obtain_pair"),
    path("api/auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/me/", MeView.as_view(), name="me"),
    path("api/", include(router.urls)),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
