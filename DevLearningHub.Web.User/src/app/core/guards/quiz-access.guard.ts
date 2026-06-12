import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const quizAccessGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const token = localStorage.getItem('accessToken');

  if (!token) {
    router.navigate(['/login']);
    return false;
  }

  return true;
};