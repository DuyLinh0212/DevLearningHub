import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  let authReq = req;

  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    const isExternal = req.url.startsWith('http://') || req.url.startsWith('https://');
    const isSameOrigin = !isExternal || req.url.includes(window.location.host);

    if (token && isSameOrigin) {
      authReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    }
  }

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('token');
        }
        router.navigate(['/login'], { queryParams: { reason: 'session_expired' } });
      }
      return throwError(() => err);
    })
  );
};