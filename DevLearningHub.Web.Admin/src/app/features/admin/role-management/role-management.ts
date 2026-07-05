import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MobileMenuService } from '../../../core/services/mobile-menu.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  RolesService, RoleItem, PermissionModule, PermissionItem
} from '../../../core/services/roles.service';
import { UserManagementComponent } from '../user-management/user-management';
import {
  buildPermissionMatrix, PermissionMatrixColumn, PermissionMatrixRow
} from './permission-matrix';

type PhanQuyenTab = 'groups' | 'users';

@Component({
  selector: 'app-role-management',
  standalone: true,
  imports: [CommonModule, FormsModule, UserManagementComponent],
  templateUrl: './role-management.html',
  styleUrl: './role-management.css'
})
export class RoleManagementComponent implements OnInit {
  private rolesSvc = inject(RolesService);
  private auth = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  public mobileMenu = inject(MobileMenuService);

  // ===== Tabs =====
  activeTab: PhanQuyenTab = 'groups';

  isLoading = false;
  roles: RoleItem[] = [];
  permissionCatalog: PermissionModule[] = [];

  // Permission matrix view model (built once from the catalog).
  matrixColumns: PermissionMatrixColumn[] = [];
  matrixRows: PermissionMatrixRow[] = [];

  // Current user's own permissions (drives action visibility).
  canCreate = false;
  canEdit = false;
  canDelete = false;
  canAssignPerm = false;
  canViewUsers = false;

  // ===== Left column: role selection =====
  selectedRole: RoleItem | null = null;
  // Working set of permissions for the selected role (edited via the matrix).
  selectedPermissions = new Set<string>();
  isSavingPermissions = false;

  // ===== Role create/edit modal =====
  isRoleModalOpen = false;
  isEditing = false;
  editingRoleId = '';
  roleForm = { name: '', description: '', isActive: true };

  // ===== Delete confirmation =====
  deletingRole: RoleItem | null = null;

  ngOnInit() {
    this.resolveOwnPermissions();

    // Sync the active tab from the query param (?tab=groups|users), defaulting to groups.
    this.route.queryParamMap.subscribe(params => {
      const tab = params.get('tab');
      this.activeTab = tab === 'users' ? 'users' : 'groups';
      this.cdr.detectChanges();
    });

    this.loadPermissionCatalog();
    this.loadRoles();
  }

  private resolveOwnPermissions() {
    this.canCreate = this.auth.hasPermission('role:create');
    this.canEdit = this.auth.hasPermission('role:edit');
    this.canDelete = this.auth.hasPermission('role:delete');
    this.canAssignPerm = this.auth.hasPermission('role:assign_permission');
    this.canViewUsers = this.auth.hasPermission('user:view_all');
  }

  // ===== Tab switching (keeps the URL in sync) =====
  switchTab(tab: PhanQuyenTab) {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge'
    });
  }

  // ===== Data loading =====
  loadRoles() {
    this.isLoading = true;
    this.rolesSvc.getRoles().subscribe({
      next: (data) => {
        this.roles = data;
        // Preserve the current selection across reloads, else select the first role.
        const previouslySelected = this.selectedRole?.id;
        const next = data.find(r => r.id === previouslySelected) ?? data[0] ?? null;
        this.selectRole(next);
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi tải roles:', err);
        this.isLoading = false;
        this.roles = [];
        this.selectedRole = null;
        this.cdr.detectChanges();
      }
    });
  }

  loadPermissionCatalog() {
    this.rolesSvc.getPermissionCatalog().subscribe({
      next: (modules) => {
        this.permissionCatalog = modules;
        const matrix = buildPermissionMatrix(modules);
        this.matrixColumns = matrix.columns;
        this.matrixRows = matrix.rows;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Lỗi tải permission catalog:', err)
    });
  }

  // ===== Left column: role selection =====
  selectRole(role: RoleItem | null) {
    this.selectedRole = role;
    this.selectedPermissions = new Set(role?.permissions ?? []);
    this.cdr.detectChanges();
  }

  // ===== Matrix editing =====

  // The matrix is read-only for system roles whose permissions are computed (Admin/User),
  // or when the user lacks role:assign_permission.
  get isMatrixEditable(): boolean {
    if (!this.selectedRole || !this.canAssignPerm) return false;
    // Admin holds the full catalog implicitly; editing its rows is meaningless.
    return !this.isComputedRole(this.selectedRole);
  }

  isComputedRole(role: RoleItem): boolean {
    const name = role.name.toLowerCase();
    return name === 'admin' || name === 'user';
  }

  // Whether a cell should render as checked. For computed roles we reflect the
  // effective permissions returned by the API so the matrix shows reality.
  isCellChecked(permission: PermissionItem | null): boolean {
    if (!permission) return false;
    if (this.selectedRole && this.isComputedRole(this.selectedRole)) {
      const effective = this.selectedRole.effectivePermissions ?? this.selectedRole.permissions;
      return effective.some(p => p.toLowerCase() === permission.name.toLowerCase());
    }
    return this.selectedPermissions.has(permission.name);
  }

  toggleCell(permission: PermissionItem | null) {
    if (!permission || !this.isMatrixEditable) return;
    if (this.selectedPermissions.has(permission.name)) {
      this.selectedPermissions.delete(permission.name);
    } else {
      this.selectedPermissions.add(permission.name);
    }
  }

  savePermissions() {
    if (!this.selectedRole || !this.isMatrixEditable) return;
    this.isSavingPermissions = true;
    this.rolesSvc.setRolePermissions(this.selectedRole.id, {
      permissions: [...this.selectedPermissions]
    }).subscribe({
      next: () => {
        this.isSavingPermissions = false;
        this.loadRoles();
      },
      error: (err) => {
        this.isSavingPermissions = false;
        alert(this.extractError(err));
      }
    });
  }

  // ===== Role CRUD =====
  openCreateModal() {
    this.isEditing = false;
    this.editingRoleId = '';
    this.roleForm = { name: '', description: '', isActive: true };
    this.isRoleModalOpen = true;
  }

  openEditModal(role: RoleItem) {
    this.isEditing = true;
    this.editingRoleId = role.id;
    this.roleForm = { name: role.name, description: role.description ?? '', isActive: role.isActive };
    this.isRoleModalOpen = true;
  }

  closeRoleModal() {
    this.isRoleModalOpen = false;
  }

  saveRole() {
    const name = this.roleForm.name.trim();
    if (!name) return;

    if (this.isEditing && this.editingRoleId) {
      this.rolesSvc.updateRole(this.editingRoleId, {
        name,
        description: this.roleForm.description.trim() || null,
        isActive: this.roleForm.isActive
      }).subscribe({
        next: () => { this.loadRoles(); this.closeRoleModal(); },
        error: (err) => alert(this.extractError(err))
      });
    } else {
      this.rolesSvc.createRole({
        name,
        description: this.roleForm.description.trim() || null,
        permissions: []
      }).subscribe({
        next: () => { this.loadRoles(); this.closeRoleModal(); },
        error: (err) => alert(this.extractError(err))
      });
    }
  }

  confirmDelete(role: RoleItem) {
    if (role.isSystem) { alert('Không thể xóa vai trò hệ thống.'); return; }
    if (role.userCount > 0) { alert(`Vai trò "${role.name}" đang được gán cho ${role.userCount} người dùng. Gỡ họ khỏi vai trò này trước khi xóa.`); return; }
    this.deletingRole = role;
  }

  executeDelete() {
    if (!this.deletingRole) return;
    const deletedId = this.deletingRole.id;
    this.rolesSvc.deleteRole(deletedId).subscribe({
      next: () => {
        this.deletingRole = null;
        if (this.selectedRole?.id === deletedId) {
          this.selectedRole = null;
        }
        this.loadRoles();
      },
      error: (err) => { alert(this.extractError(err)); this.deletingRole = null; }
    });
  }

  // ===== Helpers =====
  countPermissions(role: RoleItem): number {
    return role.permissions?.length ?? 0;
  }

  private extractError(err: any): string {
    return err.error?.message || err.error?.title || err.message || 'Lỗi không xác định';
  }
}
