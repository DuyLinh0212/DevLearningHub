import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// GET /api/admin/roles
export interface RoleItem {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  permissions: string[];
  userCount: number;
}

// POST /api/admin/roles
export interface CreateRoleRequest {
  name: string;
  description: string | null;
  permissions: string[];
}

// PUT /api/admin/roles/{id}
export interface UpdateRoleRequest {
  name: string;
  description: string | null;
  isActive: boolean;
}

// PUT /api/admin/roles/{id}/permissions
export interface SetRolePermissionsRequest {
  permissions: string[];
}

// GET /api/admin/permissions (grouped by module)
export interface PermissionItem {
  id: string;
  name: string;
  description: string | null;
  module: string | null;
}

export interface PermissionModule {
  module: string;
  permissions: PermissionItem[];
}

@Injectable({ providedIn: 'root' })
export class RolesService {
  private http = inject(HttpClient);
  private base = '/api/admin/roles';
  private permBase = '/api/admin/permissions';

  // === Roles ===
  getRoles(): Observable<RoleItem[]> {
    return this.http.get<any>(this.base).pipe(
      map((res) => (res?.data ?? res ?? []) as RoleItem[])
    );
  }

  getRole(id: string): Observable<RoleItem> {
    return this.http.get<any>(`${this.base}/${id}`).pipe(
      map((res) => (res?.data ?? res) as RoleItem)
    );
  }

  createRole(req: CreateRoleRequest): Observable<RoleItem> {
    return this.http.post<any>(this.base, req).pipe(
      map((res) => (res?.data ?? res) as RoleItem)
    );
  }

  updateRole(id: string, req: UpdateRoleRequest): Observable<RoleItem> {
    return this.http.put<any>(`${this.base}/${id}`, req).pipe(
      map((res) => (res?.data ?? res) as RoleItem)
    );
  }

  deleteRole(id: string): Observable<any> {
    return this.http.delete<any>(`${this.base}/${id}`);
  }

  setRolePermissions(id: string, req: SetRolePermissionsRequest): Observable<RoleItem> {
    return this.http.put<any>(`${this.base}/${id}/permissions`, req).pipe(
      map((res) => (res?.data ?? res) as RoleItem)
    );
  }

  // === User-role assignment ===
  assignRoleToUser(userId: string, roleId: string): Observable<any> {
    return this.http.post<any>(`/api/admin/users/${userId}/roles/${roleId}`, {});
  }

  removeRoleFromUser(userId: string, roleId: string): Observable<any> {
    return this.http.delete<any>(`/api/admin/users/${userId}/roles/${roleId}`);
  }

  // === Permission catalog ===
  getPermissionCatalog(): Observable<PermissionModule[]> {
    return this.http.get<any>(this.permBase).pipe(
      map((res) => (res?.data ?? res ?? []) as PermissionModule[])
    );
  }
}
