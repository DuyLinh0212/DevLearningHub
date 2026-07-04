import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MobileMenuService } from '../../../core/services/mobile-menu.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  RolesService, RoleItem, PermissionModule, PermissionItem
} from '../../../core/services/roles.service';

@Component({
  selector: 'app-role-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './role-management.html',
  styleUrl: './role-management.css'
})
export class RoleManagementComponent implements OnInit {
  private rolesSvc = inject(RolesService);
  private auth = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  public mobileMenu = inject(MobileMenuService);

  isLoading = false;
  roles: RoleItem[] = [];
  permissionCatalog: PermissionModule[] = [];

  // Permissions of current user
  canCreate = false;
  canEdit = false;
  canDelete = false;
  canAssignPerm = false;
  canAssignRole = false;

  // Role form modal
  isRoleModalOpen = false;
  isEditing = false;
  editingRoleId = '';
  roleForm = { name: '', description: '', isActive: true };

  // Permission assignment modal
  isPermModalOpen = false;
  permRoleId = '';
  permRoleName = '';
  selectedPermissions: Set<string> = new Set();

  // Flat permissions list for display
  allPermissions: PermissionItem[] = [];

  // Confirm delete
  deletingRole: RoleItem | null = null;

  ngOnInit() {
    this.resolveOwnPermissions();
    this.loadRoles();
    this.loadPermissionCatalog();
  }

  private resolveOwnPermissions() {
    // Use sync hasPermission which reads JWT — admin role always returns true
    this.canCreate = this.auth.hasPermission('role:create');
    this.canEdit = this.auth.hasPermission('role:edit');
    this.canDelete = this.auth.hasPermission('role:delete');
    this.canAssignPerm = this.auth.hasPermission('role:assign_permission');
    this.canAssignRole = this.auth.hasPermission('user:edit_role');
  }

  loadRoles() {
    this.isLoading = true;
    this.rolesSvc.getRoles().subscribe({
      next: (data) => {
        this.roles = data;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi tải roles:', err);
        this.isLoading = false;
        this.roles = [];
        this.cdr.detectChanges();
      }
    });
  }

  loadPermissionCatalog() {
    this.rolesSvc.getPermissionCatalog().subscribe({
      next: (modules) => {
        this.permissionCatalog = modules;
        this.allPermissions = modules.flatMap(m => m.permissions);
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Lỗi tải permission catalog:', err)
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
    if (role.isSystem) { alert('Không thể xóa role hệ thống.'); return; }
    if (role.userCount > 0) { alert(`Role "${role.name}" đang được gán cho ${role.userCount} người dùng. Gỡ họ khỏi role này trước khi xóa.`); return; }
    this.deletingRole = role;
  }

  executeDelete() {
    if (!this.deletingRole) return;
    this.rolesSvc.deleteRole(this.deletingRole.id).subscribe({
      next: () => { this.deletingRole = null; this.loadRoles(); },
      error: (err) => { alert(this.extractError(err)); this.deletingRole = null; }
    });
  }

  // ===== Permissions =====

  openPermModal(role: RoleItem) {
    this.permRoleId = role.id;
    this.permRoleName = role.name;
    this.selectedPermissions = new Set(role.permissions);
    this.isPermModalOpen = true;
  }

  closePermModal() {
    this.isPermModalOpen = false;
  }

  togglePermission(name: string) {
    if (this.selectedPermissions.has(name)) {
      this.selectedPermissions.delete(name);
    } else {
      this.selectedPermissions.add(name);
    }
  }

  savePermissions() {
    this.rolesSvc.setRolePermissions(this.permRoleId, {
      permissions: [...this.selectedPermissions]
    }).subscribe({
      next: () => { this.loadRoles(); this.closePermModal(); },
      error: (err) => alert(this.extractError(err))
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
