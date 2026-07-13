from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is not None:
        response.data = {
            "success": False,
            "status_code": response.status_code,
            "errors": response.data,
        }
        return response

    # Unhandled exception -> generic 500, never leak stack traces to client
    return Response(
        {
            "success": False,
            "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR,
            "errors": {"detail": "An unexpected error occurred. Please try again."},
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )