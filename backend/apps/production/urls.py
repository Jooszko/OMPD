from django.urls import path

from .views import (
    BatchAdvanceStageView,
    BatchStartStageView,
    BatchWasteView,
    ProductionBoardView,
    ProductionPlanView,
)

urlpatterns = [
    path('plan/', ProductionPlanView.as_view(), name='production-plan'),
    path('board/', ProductionBoardView.as_view(), name='production-board'),
    path('batches/<int:pk>/start/', BatchStartStageView.as_view(), name='production-batch-start'),
    path('batches/<int:pk>/advance/', BatchAdvanceStageView.as_view(), name='production-batch-advance'),
    path('batches/<int:pk>/waste/', BatchWasteView.as_view(), name='production-batch-waste'),
]
