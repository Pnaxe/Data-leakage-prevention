from django.db import migrations, models


def seed_permissions(apps, schema_editor):
    from core.permissions_catalog import ensure_permissions_and_role_defaults

    ensure_permissions_and_role_defaults()


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0002_document_repository"),
    ]

    operations = [
        migrations.CreateModel(
            name="AccessPermission",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("codename", models.CharField(max_length=80, unique=True)),
                ("label", models.CharField(max_length=120)),
                ("module", models.CharField(max_length=60)),
            ],
            options={
                "ordering": ["module", "label"],
            },
        ),
        migrations.AddField(
            model_name="role",
            name="is_system",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="role",
            name="label",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AlterField(
            model_name="role",
            name="name",
            field=models.CharField(max_length=60, unique=True),
        ),
        migrations.AddField(
            model_name="role",
            name="permissions",
            field=models.ManyToManyField(blank=True, related_name="roles", to="core.accesspermission"),
        ),
        migrations.RunPython(seed_permissions, migrations.RunPython.noop),
    ]
