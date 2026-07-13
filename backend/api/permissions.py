from rest_framework.permissions import BasePermission
from api.models import Role


class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == Role.SUPER_ADMIN)


class HasRole(BasePermission):
    """
    Generic role-gate. Set `allowed_roles` on the view, e.g.:
        allowed_roles = [Role.RECEPTIONIST, Role.SUPER_ADMIN]
    Super Admin is always allowed through, regardless of allowed_roles.
    """

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.role == Role.SUPER_ADMIN:
            return True
        allowed_roles = getattr(view, "allowed_roles", None)
        if not allowed_roles:
            return True  # view didn't restrict roles -> any authenticated user
        return request.user.role in allowed_roles


class IsReceptionist(HasRole):
    def has_permission(self, request, view):
        view.allowed_roles = [Role.RECEPTIONIST]
        return super().has_permission(request, view)


class IsCashierOrAccountant(HasRole):
    def has_permission(self, request, view):
        view.allowed_roles = [Role.CASHIER, Role.ACCOUNTANT]
        return super().has_permission(request, view)


class IsNurse(HasRole):
    def has_permission(self, request, view):
        view.allowed_roles = [Role.NURSE]
        return super().has_permission(request, view)


class IsDoctor(HasRole):
    def has_permission(self, request, view):
        view.allowed_roles = [Role.DOCTOR]
        return super().has_permission(request, view)


class IsLabTechnologist(HasRole):
    def has_permission(self, request, view):
        view.allowed_roles = [Role.LAB_TECHNOLOGIST]
        return super().has_permission(request, view)


class IsRadiologist(HasRole):
    def has_permission(self, request, view):
        view.allowed_roles = [Role.RADIOLOGIST]
        return super().has_permission(request, view)


class IsPharmacist(HasRole):
    def has_permission(self, request, view):
        view.allowed_roles = [Role.PHARMACIST]
        return super().has_permission(request, view)


class ReadOnlyOrSuperAdmin(BasePermission):
    """Allows safe (GET/HEAD/OPTIONS) methods to anyone authenticated,
    but restricts write methods to Super Admin. Useful for catalog/lookup
    tables like ICD10Code, LabTestCatalog, Department, etc."""

    SAFE_METHODS = ("GET", "HEAD", "OPTIONS")

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in self.SAFE_METHODS:
            return True
        return request.user.role == Role.SUPER_ADMIN