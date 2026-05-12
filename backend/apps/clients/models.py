from django.conf import settings
from django.db import models


class Route(models.Model):
    route_name = models.CharField(max_length=255)
    driver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='driven_routes',
    )

    class Meta:
        db_table = 'routes'

    def __str__(self):
        return self.route_name


class Client(models.Model):
    name = models.CharField(max_length=255)
    address = models.TextField()
    route = models.ForeignKey(
        Route,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='clients',
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'clients'

    def __str__(self):
        return self.name
