from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsAdminRole(BasePermission):
    message = 'Tylko administrator może zarządzać kontami użytkowników.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'admin')


class IsAdminRoleOrReadOnly(IsAdminRole):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return super().has_permission(request, view)
class HasRole(BasePermission):
    message = 'Nie masz uprawnień do tej części systemu.'
    roles = ()
    read_roles = None

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if request.method in SAFE_METHODS and self.read_roles is not None:
            return user.role in self.read_roles
        return user.role in self.roles


def role_permission(*roles, read=None):
    """Permission class for `roles`; `read` lets more roles use GET/HEAD/OPTIONS."""
    return type('RolePermission', (HasRole,), {'roles': roles, 'read_roles': read})


AdminOnly = role_permission('admin')
AdminOrBaker = role_permission('admin', 'baker')