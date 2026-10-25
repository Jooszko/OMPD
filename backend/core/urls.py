"""
URL configuration for core project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView
from users.views import ChangeInitialPasswordView, LoginView, LogoutView, RefreshView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('dashboard.urls')),

    path('api/users/', include('users.urls')),
    path('api/finance/', include('finance.urls')),
    path('api/clients/', include('clients.urls')),
    path('api/products/', include('products.urls')),
    path('api/orders/', include('orders.urls')),
    path('api/production/', include('production.urls')),
    path('api/audit/', include('audit.urls')),

    path('api/auth/login/', LoginView.as_view(), name ='token_obtain_pair'),
    path('api/auth/refresh/', RefreshView.as_view(), name ='token_refresh'),
    path('api/auth/logout/', LogoutView.as_view(), name='token_blacklist'),
    path('api/auth/change-password/', ChangeInitialPasswordView.as_view(), name='change-initial-password'),
]

if settings.API_DOCS_ENABLED:
    urlpatterns += [
        path('api/schema/', SpectacularAPIView.as_view(), name='api-schema'),
        path('api/docs/', SpectacularSwaggerView.as_view(url_name='api-schema'), name='api-docs'),
        path('api/redoc/', SpectacularRedocView.as_view(url_name='api-schema'), name='api-redoc'),
    ]
