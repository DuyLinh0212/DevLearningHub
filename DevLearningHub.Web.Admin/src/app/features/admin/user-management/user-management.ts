import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { forkJoin } from "rxjs";
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar';
import { MobileMenuService } from '../../../core/services/mobile-menu.service';

interface ManageRoleOption {
  name: string;
  description?: string;
  selected: boolean;
}

interface ManagePermission {
  name: string;
  description?: string;
  module: string;
  checked: boolean;
  fromRole: boolean;
}

interface ManageModule {
  module: string;
  permissions: ManagePermission[];
}

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, SidebarComponent, FormsModule],
  templateUrl: './user-management.html',
  styleUrl: './user-management.css'
})
export class UserManagementComponent implements OnInit {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  public mobileMenu = inject(MobileMenuService);

  users: any[] = [];
  searchText = '';
  filterRole = 'all';
  filterStatus = 'all';
  isLoading = false;

  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalCount = 0;
  totalPages = 1;
  pageNumbers: number[] = [];

  // Modals state
  isCreateModalOpen = false;
  isLockModalOpen = false;
  selectedUser: any = null;

  // Forms
  createForm = {
    username: '',
    email: '',
    password: '',
    fullName: '',
    role: 'User'
  };

  lockForm = {
    reason: ''
  };
  // Permissions modal state
  isPermissionModalOpen = false;
  isPermissionLoading = false;
  isPermissionSaving = false;
  permissionModules: any[] = [];
  userPermissions: any = null;
  permissionStateMap: Record<string, "inherit" | "grant" | "deny"> = {};

  rolesList = ['Admin', 'Moderator', 'User']; // Show all roles

  // Manage modal (role + permissions combined)
  isManageModalOpen = false;
  isLoadingManage = false;
  isSavingManage = false;
  manageUser: any = null;
  manageRoles: ManageRoleOption[] = [];
  manageModules: ManageModule[] = [];
  manageSelectedRole = 'User';
  manageChecked: Record<string, boolean> = {};

  // Permissions that are never assignable to certain roles, so they are hidden
  // from the checkbox list (and stripped on save) when that role is selected.
  private readonly roleHiddenPermissions: Record<string, string[]> = {
    User: [
      'audit:view',
      'system.full_control',
      'user:view_all', 'user:ban', 'user:edit_role', 'user:force_logout'
    ]
  };

  // Permissions that are always granted to certain roles as a baseline (even if
  // the role's default set lacks them). Admins can still uncheck them to deny.
  private readonly roleDefaultGrants: Record<string, string[]> = {
    User: [
      'quiz:create', 'quiz:edit',
      'comment:create',
      'post:create', 'post:edit_own'
    ]
  };

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.isLoading = true;
    this.cdr.detectChanges();

    let url = `/api/admin/users?page=${this.currentPage}&pageSize=${this.pageSize}`;
    if (this.searchText.trim()) {
      url += `&search=${encodeURIComponent(this.searchText.trim())}`;
    }

    this.http.get<any>(url).subscribe({
      next: (res) => {
        const responseData = res?.data;
        const items = responseData?.items || [];

        this.users = items.map((u: any) => ({
          id: u.id,
          username: u.username || 'N/A',
          fullName: u.fullName || 'Chưa cập nhật',
          avatarUrl: u.avatarUrl || '',
          email: u.email || 'N/A',
          xpPoints: u.xpPoints || 0,
          isActive: u.isActive ?? true,
          isLocked: u.isLocked ?? false,
          createdAt: u.createdAt,
          role: u.roles && u.roles.length > 0 ? u.roles[0] : 'User'
        }));

        this.totalCount = responseData?.totalCount || this.users.length;
        this.totalPages = Math.ceil(this.totalCount / this.pageSize) || 1;
        this.calculatePageNumbers();
        this.applyLocalFilters();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lá»—i táº£i danh sÃ¡ch ngÆ°á»i dÃ¹ng:', err);
        this.users = [];
        this.totalCount = 0;
        this.totalPages = 1;
        this.calculatePageNumbers();
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  applyLocalFilters() {
    let filtered = [...this.users];

    if (this.filterRole !== 'all') {
      filtered = filtered.filter(u => u.role.toLowerCase() === this.filterRole.toLowerCase());
    }

    if (this.filterStatus !== 'all') {
      if (this.filterStatus === 'locked') {
        filtered = filtered.filter(u => u.isLocked);
      } else {
        filtered = filtered.filter(u => !u.isLocked);
      }
    }

    this.users = filtered;
  }

  calculatePageNumbers() {
    this.pageNumbers = [];
    for (let i = 1; i <= this.totalPages; i++) {
      this.pageNumbers.push(i);
    }
  }

  onSearchChange() {
    this.currentPage = 1;
    this.loadUsers();
  }

  onFilterChange() {
    this.currentPage = 1;
    this.loadUsers();
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadUsers();
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  // --- ACTIONS ---

  // Create User
  openCreateModal() {
    this.createForm = {
      username: '',
      email: '',
      password: '',
      fullName: '',
      role: 'User'
    };
    this.isCreateModalOpen = true;
    this.cdr.detectChanges();
  }

  closeCreateModal() {
    this.isCreateModalOpen = false;
    this.cdr.detectChanges();
  }

  saveNewUser() {
    const { username, email, password, fullName, role } = this.createForm;
    if (!username.trim() || !email.trim() || !password.trim() || !fullName.trim()) {
      alert('Vui lÃ²ng Ä‘iá»n Ä‘áº§y Ä‘á»§ thÃ´ng tin tÃ i khoáº£n!');
      return;
    }

    const registerPayload = {
      username: username.trim(),
      email: email.trim(),
      password: password,
      fullName: fullName.trim()
    };

    // Step 1: Register User (creates User in DB with default 'User' role)
    this.http.post<any>('/api/auth/register', registerPayload).subscribe({
      next: (res) => {
        const userId = res?.data?.userId || res?.userId || res?.data?.id || res?.id;
        if (!userId) {
          // If response format has user under res.data.user
          const nestedUserId = res?.data?.user?.id || res?.user?.id;
          if (nestedUserId) {
            this.proceedWithRoleUpdate(nestedUserId, role);
          } else {
            alert('Táº¡o tÃ i khoáº£n thÃ nh cÃ´ng nhÆ°ng khÃ´ng láº¥y Ä‘Æ°á»£c ID Ä‘á»ƒ phÃ¢n quyá»n!');
            this.closeCreateModal();
            this.loadUsers();
          }
          return;
        }

        this.proceedWithRoleUpdate(userId, role);
      },
      error: (err) => {
        console.error('Lá»—i táº¡o tÃ i khoáº£n:', err);
        const msg = err?.error?.message || 'KhÃ´ng thá»ƒ táº¡o tÃ i khoáº£n má»›i. Vui lÃ²ng kiá»ƒm tra láº¡i thÃ´ng tin!';
        alert(msg);
      }
    });
  }

  proceedWithRoleUpdate(userId: string, role: string) {
    // Step 2: Elevate role if selected role is not 'User'
    if (role !== 'User') {
      this.http.put(`/api/admin/users/${userId}/role`, { role }).subscribe({
        next: () => {
          alert(`Táº¡o tÃ i khoáº£n thÃ nh cÃ´ng vá»›i quyá» n ${role}!`);
          this.closeCreateModal();
          this.loadUsers();
        },
        error: (err) => {
          console.error('Lá»—i phÃ¢n quyá» n sau Ä‘Äƒng kÃ½:', err);
          alert('Ä Ã£ táº¡o tÃ i khoáº£n thÃ nh cÃ´ng nhÆ°ng gáº·p lá»—i phÃ¢n quyá» n. Báº¡n hÃ£y phÃ¢n quyá» n thá»§ cÃ´ng trong danh sÃ¡ch!');
          this.closeCreateModal();
          this.loadUsers();
        }
      });
    } else {
      alert('Táº¡o tÃ i khoáº£n há» c viÃªn (User) thÃ nh cÃ´ng!');
      this.closeCreateModal();
      this.loadUsers();
    }
  }

  // Lock / Unlock
  toggleLock(user: any) {
    this.selectedUser = user;
    if (user.isLocked) {
      if (confirm(`Báº¡n cÃ³ cháº¯c muá»‘n má»Ÿ khÃ³a tÃ i khoáº£n ${user.username}?`)) {
        this.http.patch<any>(`/api/admin/users/${user.id}/unlock`, {}).subscribe({
          next: () => {
            alert('Má»Ÿ khÃ³a tÃ i khoáº£n thÃ nh cÃ´ng!');
            this.loadUsers();
          },
          error: (err) => {
            console.error('Lá»—i má»Ÿ khÃ³a:', err);
            alert('KhÃ´ng thá»ƒ má»Ÿ khÃ³a tÃ i khoáº£n!');
          }
        });
      }
    } else {
      this.lockForm = { reason: '' };
      this.isLockModalOpen = true;
      this.cdr.detectChanges();
    }
  }

  closeLockModal() {
    this.isLockModalOpen = false;
    this.selectedUser = null;
    this.cdr.detectChanges();
  }

  confirmLock() {
    if (!this.selectedUser) return;
    const reason = this.lockForm.reason.trim() || 'Vi pháº¡m chÃ­nh sÃ¡ch';

    this.http.patch<any>(`/api/admin/users/${this.selectedUser.id}/lock`, { reason }).subscribe({
      next: () => {
        // Force logout: delete refresh tokens so the user is immediately logged out.
        this.http.post(`/api/admin/users/${this.selectedUser.id}/management/logout`, {}).subscribe({
          next: () => {
            alert('Khóa tài khoản và đá người dùng thành công!');
            this.closeLockModal();
            this.loadUsers();
          },
          error: (err) => {
            console.error('Lỗi logout người dùng:', err);
            alert('Khóa tài khoản thành công, nhưng không thể đá người dùng ngay!');
            this.closeLockModal();
            this.loadUsers();
          }
        });
      },
      error: (err) => {
        console.error('Lá»—i khÃ³a tÃ i khoáº£n:', err);
        alert('KhÃ´ng thá»ƒ khÃ³a tÃ i khoáº£n!');
      }
    });
  }

  openPermissionModal(user: any) {
    this.selectedUser = user;
    this.isPermissionModalOpen = true;
    this.isPermissionLoading = true;
    this.permissionStateMap = {};
    this.userPermissions = null;
    this.permissionModules = [];

    forkJoin({
      catalog: this.http.get<any>("/api/admin/permissions"),
      userPerms: this.http.get<any>(`/api/admin/users/${user.id}/permissions`)
    }).subscribe({
      next: ({ catalog, userPerms }) => {
        const catData = catalog?.data ?? catalog;
        const permsData = userPerms?.data ?? userPerms;

        this.permissionModules = Array.isArray(catData) ? catData : [];
        this.userPermissions = permsData;

        const stateMap: Record<string, "inherit" | "grant" | "deny"> = {};
        for (const mod of this.permissionModules) {
          for (const p of mod.permissions) {
            stateMap[p.name] = "inherit";
          }
        }

        if (permsData) {
          const { grants = [], denies = [] } = permsData;
          for (const name of grants) { stateMap[name] = "grant"; }
          for (const name of denies) { stateMap[name] = "deny"; }
        }

        this.permissionStateMap = stateMap;
        this.isPermissionLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error("Lá»—i táº£i quyá» n chi tiáº¿t:", err);
        alert("KhÃ´ng thá»ƒ táº£i danh sÃ¡ch quyá» n.");
        this.closePermissionModal();
      }
    });
  }

  closePermissionModal() {
    this.isPermissionModalOpen = false;
    this.permissionModules = [];
    this.userPermissions = null;
    this.permissionStateMap = {};
    this.cdr.detectChanges();
  }

  savePermissions() {
    if (!this.selectedUser) return;
    this.isPermissionSaving = true;
    const allItems = Object.entries(this.permissionStateMap)
      .map(([permission, state]) => ({ permission, state }));

    this.http.put<any>(`/api/admin/users/${this.selectedUser.id}/permissions`, { items: allItems }).subscribe({
      next: () => {
        this.isPermissionSaving = false;
        alert("Ä Ã£ cáº­p nháº­t phÃ¢n quyá» n. Quyá» n má»›i cÃ³ hiá»‡u lá»±c sau khi user Ä‘Äƒng nháº­p láº¡i.");
        this.closePermissionModal();
      },
      error: (err) => {
        this.isPermissionSaving = false;
        console.error("Lá»—i lÆ°u quyá» n:", err);
        alert("KhÃ´ng thá»ƒ lÆ°u phÃ¢n quyá» n.");
      }
    });
  }

  onAvatarError(event: Event) {
    const img = event.target as HTMLImageElement;
    if (img) img.src = 'assets/images/default-avatar.svg';
  }

  viewUserProfile(userId: string) {
    this.router.navigate(['/admin/users', userId], { queryParams: { returnUrl: this.router.url } });
  }

  // Called when the selected role changes (from radio buttons).
  onRoleChange() {
    this.applyRolePermissionPresets();
  }

  // Apply baseline grants for certain roles. Admin can still uncheck them to deny.
  private applyRolePermissionPresets() {
    if (this.manageSelectedRole === 'User') {
      const defaults = this.roleDefaultGrants['User'] || [];
      for (const mod of this.manageModules) {
        for (const perm of mod.permissions) {
          if (defaults.includes(perm.name)) {
            this.manageChecked[perm.name] = true;
          }
        }
      }
    }
  }

  // --- MANAGE USER (role + permissions in one screen) ---

  openManageModal(user: any) {
    this.manageUser = { ...user };
    this.isManageModalOpen = true;
    this.isLoadingManage = true;
    this.manageRoles = [];
    this.manageModules = [];
    this.manageChecked = {};
    this.manageSelectedRole = user.role || 'User';
    this.cdr.detectChanges();

    this.http.get<any>(`/api/admin/users/${user.id}/management`).subscribe({
      next: (res) => {
        const data = res?.data || {};
        this.manageRoles = data.roles || [];
        this.manageModules = data.permissionModules || [];
        this.manageSelectedRole = this.manageRoles.find(r => r.selected)?.name || user.role || 'User';

        this.manageChecked = {};
        for (const mod of this.manageModules) {
          for (const perm of mod.permissions) {
            this.manageChecked[perm.name] = !!perm.checked;
          }
        }

        // Apply baseline grants (e.g., quiz perms for User) after loading initial checked state.
        this.applyRolePermissionPresets();

        this.manageUser = {
          ...this.manageUser,
          username: data.username ?? this.manageUser.username,
          email: data.email ?? this.manageUser.email,
          fullName: data.fullName ?? this.manageUser.fullName,
          avatarUrl: data.avatarUrl ?? this.manageUser.avatarUrl
        };

        this.isLoadingManage = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi tải dữ liệu quản lý người dùng:', err);
        this.isLoadingManage = false;
        alert(err?.error?.message || 'Không thể tải dữ liệu quản lý người dùng!');
        this.closeManageModal();
      }
    });
  }

  closeManageModal() {
    this.isManageModalOpen = false;
    this.manageUser = null;
    this.manageRoles = [];
    this.manageModules = [];
    this.manageChecked = {};
    this.cdr.detectChanges();
  }

  togglePermission(name: string) {
    this.manageChecked[name] = !this.manageChecked[name];
  }

  // Whether a permission is shown for the currently selected role.
  isPermissionVisible(perm: ManagePermission): boolean {
    const hidden = this.roleHiddenPermissions[this.manageSelectedRole] || [];
    return !hidden.includes(perm.name);
  }

  // Permissions of a module that are visible for the current role.
  visiblePermissions(mod: ManageModule): ManagePermission[] {
    return mod.permissions.filter(p => this.isPermissionVisible(p));
  }

  // Modules that still have at least one visible permission for the current role.
  visibleModules(): ManageModule[] {
    return this.manageModules.filter(m => this.visiblePermissions(m).length > 0);
  }

  countCheckedInModule(mod: ManageModule): number {
    return this.visiblePermissions(mod).filter(p => this.manageChecked[p.name]).length;
  }

  saveManage() {
    if (!this.manageUser) return;
    if (!this.manageSelectedRole) {
      alert('Vui lòng chọn vai trò cho người dùng!');
      return;
    }

    // Never persist permissions that are hidden for the selected role.
    const hidden = this.roleHiddenPermissions[this.manageSelectedRole] || [];
    const permissions = Object.keys(this.manageChecked)
      .filter(name => this.manageChecked[name] && !hidden.includes(name));

    this.isSavingManage = true;
    this.cdr.detectChanges();

    this.http.put<any>(`/api/admin/users/${this.manageUser.id}/management`, {
      role: this.manageSelectedRole,
      permissions
    }).subscribe({
      next: () => {
        this.isSavingManage = false;
        alert('Lưu vai trò và quyền hạn thành công!');
        this.closeManageModal();
        this.loadUsers();
      },
      error: (err) => {
        this.isSavingManage = false;
        console.error('Lỗi lưu quản lý người dùng:', err);
        alert(err?.error?.message || 'Không thể lưu vai trò và quyền hạn!');
        this.cdr.detectChanges();
      }
    });
  }
}

