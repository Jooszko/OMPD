from drf_spectacular.utils import OpenApiResponse
from rest_framework import serializers


class ErrorSerializer(serializers.Serializer):
    error = serializers.CharField()


def error_response(description):
    return OpenApiResponse(ErrorSerializer, description=description)