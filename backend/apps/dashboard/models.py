from django.db import models


class RouteDirectionsCache(models.Model):
    cache_key = models.CharField(max_length=64, unique=True)
    provider = models.CharField(max_length=10)
    coordinates = models.JSONField()
    distance_m = models.FloatField()
    duration_s = models.FloatField()
    fetched_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.provider} {self.cache_key[:12]}… ({self.fetched_at:%Y-%m-%d})'
