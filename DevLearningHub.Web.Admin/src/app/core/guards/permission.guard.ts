import { inject } from '@angular/core';
import { Router } from '@angular/router';

/**
 * Factory function that creates a guard requiring specific permission(s).
 * Usage:
 *   canActivate: [permissionGuard('post:hide')]  // single permission
 *   canActivate: [permissionGuard(['post:hide', 'post:edit_any', 'post:delete_any'])] // any of these
 *
 * NOTE: JWT stores permissions as multiple 'permission' claims (singular key),
 * not as a single 'permissions' array. When decoded, they appear under 'permission' key.
 */
export const permissionGuard = (requiredPermissions: string | string[]) => {
  return () => {
    const router = inject(Router);
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');

    if (!token) {
      router.navigate(['/login']);
      return false;
    }

    try {
      const payloadPart = token.split('.')[1];
      const decoded = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')));

      // Check role first (Admin has full control)
      const roleClaim = decoded['role'] || decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
      const roles = Array.isArray(roleClaim)
        ? roleClaim.map((r: string) => r.toLowerCase())
        : [(roleClaim || '').toLowerCase()];
      if (roles.includes('admin')) {
        return true;
      }

      // JWT stores permissions as multiple 'permission' claims (singular, not 'permissions')
      // When decoded to JSON, multiple same-key claims become an array under that key
      const permClaim = decoded['permission'];
      const tokenPermissions: string[] = Array.isArray(permClaim)
        ? permClaim
        : (permClaim ? [permClaim] : []);

      // Check full_control wildcard
      if (tokenPermissions.some((p: string) => p.toLowerCase() === 'system.full_control')) {
        return true;
      }

      // Check required permission(s) - any match is sufficient
      const requiredList = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
      return requiredList.some((reqPerm: string) =>
        tokenPermissions.some((p: string) => p.toLowerCase() === reqPerm.toLowerCase())
      );
    } catch (e) {
      console.error('Lỗi kiểm tra permission trong Guard:', e);
      router.navigate(['/login']);
      return false;
    }
  };
};
