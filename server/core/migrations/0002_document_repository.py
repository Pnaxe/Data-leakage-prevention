import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def create_default_categories(apps, schema_editor):
    DocumentCategory = apps.get_model("core", "DocumentCategory")
    categories = [
        "HR Documents",
        "Finance Reports",
        "Payroll Files",
        "Customer Records",
        "Legal Documents",
        "IT/System Files",
        "Confidential Reports",
    ]
    for name in categories:
        DocumentCategory.objects.get_or_create(name=name)


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="DocumentCategory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120, unique=True)),
                ("description", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="Document",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=180)),
                ("description", models.TextField(blank=True)),
                ("file", models.FileField(upload_to="documents/")),
                ("sensitivity", models.CharField(choices=[("low", "Low"), ("medium", "Medium"), ("high", "High"), ("critical", "Critical")], default="medium", max_length=20)),
                ("status", models.CharField(choices=[("active", "Active"), ("archived", "Archived")], default="active", max_length=20)),
                ("version", models.CharField(blank=True, max_length=40)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("archived_at", models.DateTimeField(blank=True, null=True)),
                ("allowed_roles", models.ManyToManyField(blank=True, to="core.role")),
                ("category", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="documents", to="core.documentcategory")),
                ("uploaded_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="uploaded_documents", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="DocumentActivity",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("action", models.CharField(choices=[("upload", "Upload Document"), ("view", "View Document"), ("download", "Download Document"), ("edit", "Edit Document Details"), ("archive", "Archive Document"), ("delete", "Delete Document"), ("permission_change", "Access Permissions Changed")], max_length=40)),
                ("details", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("document", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="history", to="core.document")),
                ("user", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="document_activities", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.RunPython(create_default_categories, migrations.RunPython.noop),
    ]
