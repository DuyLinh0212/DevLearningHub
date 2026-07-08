import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, tap} from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private apiUrl = '/api/auth';

  register(payload: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/register`, payload).pipe(
      map((res) => res?.data || res)
    );
  }

  login(payload: any) {
    return this.http.post<any>(`${this.apiUrl}/login`, payload).pipe(
      map((res) => res?.data || res) ,
      tap((data) => {
        if (data?.accessToken) {
          localStorage.setItem('accessToken', data.accessToken);
        }
        if (data?.refreshToken) {
          localStorage.setItem('refreshToken', data.refreshToken);
        }
      })
    );
  }

  googleLogin(idToken: string) {
    return this.http.post<any>(`${this.apiUrl}/google`, { idToken }).pipe(
      map((res) => res?.data || res),
      tap((data) => {
        if (data?.accessToken) {
          localStorage.setItem('accessToken', data.accessToken);
        }
        if (data?.refreshToken) {
          localStorage.setItem('refreshToken', data.refreshToken);
        }
      })
    );
  }
}