import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private apiUrl = '/api/auth';

  register(payload: any) {
    return this.http.post<any>(`${this.apiUrl}/register`, payload).pipe(
      map((res) => res.data)
    );
  }

  login(payload: any) {
    return this.http.post<any>(`${this.apiUrl}/login`, payload).pipe(
      map((res) => res.data)
    );
  }
}
