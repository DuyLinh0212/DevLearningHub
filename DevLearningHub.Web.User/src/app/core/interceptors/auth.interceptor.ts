import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

let sessionExpiredHandled = false;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  let authReq = req;

  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    if (token) {
      authReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    }
  }

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && typeof window !== 'undefined' && !sessionExpiredHandled) {
        const hadToken = !!(localStorage.getItem('accessToken') || localStorage.getItem('token'));
        localStorage.removeItem('accessToken');
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');

        if (hadToken) {
          sessionExpiredHandled = true;
          // Thông báo cho toàn app biết session đã hết hạn
          window.dispatchEvent(new CustomEvent('session-expired'));
          // Đợi 2 giây để user đọc thông báo rồi mới chuyển trang
          setTimeout(() => {
            sessionExpiredHandled = false;
            router.navigate(['/login'], { queryParams: { reason: 'session_expired' } });
          }, 2000);
        } else {
          router.navigate(['/login'], { queryParams: { reason: 'session_expired' } });
        }
      }
      return throwError(() => err);
    })
  );
};