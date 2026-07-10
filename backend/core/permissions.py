from __future__ import annotations

from rest_framework.permissions import BasePermission


class HasRole(BasePermission):
    allowed_roles: set[str] = set()

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and (not self.allowed_roles or user.role in self.allowed_roles))


class IsSalesRepresentativeOrManager(HasRole):
    allowed_roles = {
        "sales_representative",
        "sales_manager",
        "system_administrator",
    }


class IsSalesManagerOrAdmin(HasRole):
    allowed_roles = {
        "sales_manager",
        "system_administrator",
    }


class IsMarketingOrAdmin(HasRole):
    allowed_roles = {
        "marketing_executive",
        "system_administrator",
    }


class IsSystemAdministrator(HasRole):
    allowed_roles = {
        "system_administrator",
    }
