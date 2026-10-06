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

class ClientAction(models.Model):
    action_id = models.UUIDField(primary_key=True)
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='client_actions')
    processed_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.action_id} ({self.user_id}, {self.processed_at:%Y-%m-%d %H:%M})'
