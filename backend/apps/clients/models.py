from django.db import models
from common.models import TimeStampedModel

class Route(TimeStampedModel):
    route_id = models.AutoField(primary_key=True)
    route_name = models.CharField(max_length=100)
    driver = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, related_name='routes')
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.route_name
    
class Client(TimeStampedModel):
    client_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200)
    address = models.TextField()
    route = models.ForeignKey(Route, on_delete=models.CASCADE, related_name='clients')
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name