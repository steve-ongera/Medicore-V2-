import threading

_thread_locals = threading.local()


def get_current_user():
    return getattr(_thread_locals, "user", None)


def get_current_request():
    return getattr(_thread_locals, "request", None)


def set_current_user(user):
    """
    Django's auth middleware runs before DRF's JWTAuthentication resolves
    request.user, so views call this in `initial()` once the real user
    is known, keeping the thread-local in sync for signal handlers.
    """
    _thread_locals.user = user


class AuditLogMiddleware:
    """
    Stashes the current request/user in thread-local storage so that
    model signals (which don't have access to the request) can still
    know 'who did this' for audit logging purposes.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        _thread_locals.request = request
        _thread_locals.user = getattr(request, "user", None)
        try:
            response = self.get_response(request)
        finally:
            _thread_locals.request = None
            _thread_locals.user = None
        return response