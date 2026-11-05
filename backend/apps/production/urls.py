from django.urls import path

from .views import (
    BakeSpecDetailView,
    BatchAdvanceStageView,
    BatchStartStageView,
    BatchWasteView,
    DoughDetailView,
    DoughListView,
    DoughSuggestionsView,
    MixerDetailView,
    MixerListView,
    ProductionBoardView,
    ProductionCalendarView,
    ProductionPlanView,
    ProductionSettingsView,
)

urlpatterns = [
    path('plan/', ProductionPlanView.as_view(), name='production-plan'),
    path('board/', ProductionBoardView.as_view(), name='production-board'),
    path('calendar/', ProductionCalendarView.as_view(), name='production-calendar'),
    path('batches/<int:pk>/start/', BatchStartStageView.as_view(), name='production-batch-start'),
    path('batches/<int:pk>/advance/', BatchAdvanceStageView.as_view(), name='production-batch-advance'),
    path('batches/<int:pk>/waste/', BatchWasteView.as_view(), name='production-batch-waste'),
    path('settings/', ProductionSettingsView.as_view(), name='production-settings'),
    path('mixers/', MixerListView.as_view(), name='production-mixer-list'),
    path('mixers/<int:pk>/', MixerDetailView.as_view(), name='production-mixer-detail'),
    path('doughs/', DoughListView.as_view(), name='production-dough-list'),
    path('doughs/<int:pk>/', DoughDetailView.as_view(), name='production-dough-detail'),
    path('bake-specs/<int:product_id>/', BakeSpecDetailView.as_view(), name='production-bake-spec'),
    path(
        'products/<int:product_id>/dough-suggestions/', DoughSuggestionsView.as_view(),
        name='production-dough-suggestions',
    ),
]
