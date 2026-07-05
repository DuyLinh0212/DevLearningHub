import { inject } from '@angular/core';
import { Router } from '@angular/router';

export const adminGuard = () => {
  const router = inject(Router);
  const token = localStorage.getItem('accessToken') || localStorage.getItem('token');

  if (token) {
    try {
      const payloadPart = token.split('.')[1];
      const decodedPayload = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')));
      const roleClaim = decodedPayload['role'] || decodedPayload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];

      const isAdminOrModerator = Array.isArray(roleClaim)
        ? roleClaim.map((r: string) => r.toLowerCase()).includes('admin') ||
          roleClaim.map((r: string) => r.toLowerCase()).includes('moderator')
        : ['admin', 'moderator'].includes((roleClaim || '').toLowerCase());

      if (isAdminOrModerator) return true;

      // Check for admin:access permission (allows non-Admin/Moderator roles to access admin panel)
      const permClaim = decodedPayload['permission'];
      const permList: string[] = Array.isArray(permClaim)
        ? permClaim
        : (permClaim ? [permClaim] : []);
      if (permList.some((p: string) => p.toLowerCase() === 'admin:access' || p.toLowerCase() === 'system.full_control')) {
        return true;
      }
    } catch (e) {
      console.error('Error decoding token in Guard:', e);
    }
  }

  router.navigate(['/login']);
  return false;
};