import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, tap} from 'rxjs/operators';

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  xpPoints: number;
  roles: string[];
  permissions: string[];
}

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

  getCurrentUser(): Observable<UserProfile> {
    return this.http.get<any>('/api/users/me').pipe(
      map((res) => {
        const data = res?.data || res;
        return {
          id: data.id,
          username: data.username,
          email: data.email,
          fullName: data.fullName,
          avatarUrl: data.avatarUrl,
          xpPoints: data.xpPoints,
          roles: Array.isArray(data.roles) ? data.roles : [],
          permissions: Array.isArray(data.permissions) ? data.permissions : []
        };
      })
    );
  }

  hasPermission(permission: string): boolean {
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    if (!token) return false;

    try {
      const payloadPart = token.split('.')[1];
      const decoded = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')));
      const permissions = decoded['permissions'] || decoded['role_permissions'] || [];
      if (Array.isArray(permissions)) {
        return permissions.includes(permission);
      }
      // Fallback: check role from token
      const roleClaim = decoded['role'] || decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
      const role = Array.isArray(roleClaim) ? roleClaim[0] : roleClaim;
      if (role?.toLowerCase() === 'admin') return true;
      if (role?.toLowerCase() === 'moderator' && permission === 'comment:hide') return true;
    } catch (e) {
      console.error('Error decoding token:', e);
    }
    return false;
  }

  isAdminOrModerator(): boolean {
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    if (!token) return false;

    try {
      const payloadPart = token.split('.')[1];
      const decoded = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')));
      const roleClaim = decoded['role'] || decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
      const roles = Array.isArray(roleClaim) ? roleClaim : [roleClaim];
      return ['admin', 'moderator'].some(r => roles.map(r => r.toLowerCase()).includes(r));
    } catch (e) {
      console.error('Error decoding token:', e);
    }
    return false;
  }

  getRoles(): string[] {
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    if (!token) return [];

    try {
      const payloadPart = token.split('.')[1];
      const decoded = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')));
      const roleClaim = decoded['role'] || decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
      return Array.isArray(roleClaim) ? roleClaim.map((r: string) => r.toLowerCase()) : [roleClaim?.toLowerCase()];
    } catch (e) {
      console.error('Error decoding token:', e);
    }
    return [];
  }
}