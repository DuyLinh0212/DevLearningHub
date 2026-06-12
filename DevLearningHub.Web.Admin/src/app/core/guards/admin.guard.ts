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
      
      const isAdmin = Array.isArray(roleClaim) 
        ? roleClaim.map((r: string) => r.toLowerCase()).includes('admin') 
        : roleClaim?.toLowerCase() === 'admin';
      
      if (isAdmin) return true;
    } catch (e) {
      console.error('Lỗi giải mã token trong Guard:', e);
    }
  }
  
  router.navigate(['/login']);
  return false;
};