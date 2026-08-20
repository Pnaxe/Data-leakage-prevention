from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand

from core.detection import ensure_default_rules
from core.models import ActivityLog, Document, DocumentCategory, Role, SensitiveFile
from core.permissions_catalog import ensure_permissions_and_role_defaults


class Command(BaseCommand):
    help = "Create demo roles, users, files, rules, and activity logs."

    def handle(self, *args, **options):
        User = get_user_model()
        roles = {}
        ensure_permissions_and_role_defaults()
        roles = {role.name: role for role in Role.objects.all()}

        admin, _ = User.objects.update_or_create(
            username="admin",
            defaults={"email": "admin@example.com", "role": roles[Role.ADMIN], "department": "ICT Security"},
        )
        admin.set_password("admin12345")
        admin.is_staff = True
        admin.is_superuser = True
        admin.role = roles[Role.ADMIN]
        admin.save()

        officer, _ = User.objects.update_or_create(
            username="officer",
            defaults={"email": "officer@example.com", "role": roles[Role.SECURITY_OFFICER], "department": "SOC"},
        )
        officer.set_password("officer12345")
        officer.role = roles[Role.SECURITY_OFFICER]
        officer.save()

        user, _ = User.objects.update_or_create(
            username="user",
            defaults={"email": "user@example.com", "role": roles[Role.NORMAL_USER], "department": "Finance"},
        )
        user.set_password("user12345")
        user.role = roles[Role.NORMAL_USER]
        user.save()

        file_obj, _ = SensitiveFile.objects.get_or_create(
            path="/data/payroll/q2-salaries.xlsx",
            defaults={
                "name": "Q2 Payroll Salaries",
                "owner_department": "Finance",
                "sensitivity": SensitiveFile.CRITICAL,
                "requires_approval": True,
            },
        )
        file_obj.allowed_roles.set([roles[Role.ADMIN], roles[Role.SECURITY_OFFICER]])

        ensure_default_rules()
        for category in [
            "HR Documents",
            "Finance Reports",
            "Payroll Files",
            "Customer Records",
            "Legal Documents",
            "IT/System Files",
            "Confidential Reports",
        ]:
            DocumentCategory.objects.get_or_create(name=category)
        finance_category = DocumentCategory.objects.get(name="Finance Reports")
        hr_category = DocumentCategory.objects.get(name="HR Documents")

        self._ensure_document(
            title="Employee Handbook",
            category=hr_category,
            uploaded_by=admin,
            description="Shared handbook for staff with authorized access.",
            sensitivity=SensitiveFile.LOW,
            version="v1.0",
            allowed_roles=[roles[Role.ADMIN], roles[Role.SECURITY_OFFICER], roles[Role.NORMAL_USER]],
            requires_approval=False,
            file_name="employee-handbook.txt",
            file_content="Company handbook and onboarding notes.",
        )
        self._ensure_document(
            title="Quarterly Finance Summary",
            category=finance_category,
            uploaded_by=officer,
            description="Finance summary for security and finance staff.",
            sensitivity=SensitiveFile.HIGH,
            version="v2.1",
            allowed_roles=[roles[Role.SECURITY_OFFICER], roles[Role.NORMAL_USER]],
            requires_approval=False,
            file_name="quarterly-finance-summary.txt",
            file_content="Quarterly finance summary for demo access tests.",
        )
        self._ensure_document(
            title="Executive Payroll Master",
            category=DocumentCategory.objects.get(name="Payroll Files"),
            uploaded_by=admin,
            description="Admin-only critical payroll extract. Requires re-auth and approval to download.",
            sensitivity=SensitiveFile.CRITICAL,
            version="v1.0",
            allowed_roles=[roles[Role.ADMIN]],
            requires_approval=True,
            file_name="executive-payroll-master.txt",
            file_content="Confidential payroll extract for admin review only.",
        )

        from core.document_access import sync_sensitive_file_from_document

        for document in Document.objects.filter(sensitivity__in=[SensitiveFile.HIGH, SensitiveFile.CRITICAL]):
            sync_sensitive_file_from_document(document)

        ActivityLog.objects.get_or_create(
            user=user,
            file=file_obj,
            action=ActivityLog.FAILED_ACCESS,
            defaults={"source_ip": "192.168.1.25", "details": "Demo failed access attempt"},
        )

        self.stdout.write(self.style.SUCCESS("Demo data created. Logins: admin/admin12345, officer/officer12345, user/user12345"))

    def _ensure_document(
        self,
        *,
        title,
        category,
        uploaded_by,
        description,
        sensitivity,
        version,
        allowed_roles,
        file_name,
        file_content,
        requires_approval=False,
    ):
        document, created = Document.objects.get_or_create(
            title=title,
            defaults={
                "category": category,
                "uploaded_by": uploaded_by,
                "description": description,
                "sensitivity": sensitivity,
                "version": version,
                "requires_approval": requires_approval,
            },
        )
        if created or not document.file:
            document.file.save(file_name, ContentFile(file_content), save=False)
        document.category = category
        document.uploaded_by = uploaded_by
        document.description = description
        document.sensitivity = sensitivity
        document.version = version
        document.requires_approval = requires_approval
        document.status = Document.ACTIVE
        document.archived_at = None
        document.save()
        document.allowed_roles.set(allowed_roles)
