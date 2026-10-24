from django.conf import settings
from django.utils import timezone

from .standing import ensure_standing_orders


class StandingOrdersMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.ensured_on = None

    def __call__(self, request):
        today = timezone.localdate()
        if settings.AUTO_STANDING_ORDERS and self.ensured_on != today and request.path.startswith('/api/'):
            ensure_standing_orders(today)
            self.ensured_on = today
        return self.get_response(request)