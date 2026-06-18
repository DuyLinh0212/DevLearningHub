import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar';
import { MobileMenuService } from '../../../core/services/mobile-menu.service';

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
  isRoleModalOpen = false;
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

  roleForm = {
    role: 'User'
  };

  lockForm = {
    reason: ''
  };

  rolesList = ['Admin', 'Moderator', 'User'];

  // Permissions Modal
  isPermissionsModalOpen = false;
  isLoadingPermissions = false;
  isSavingPermissions = false;
  permissionCatalog: { module: string; permissions: { id: string; name: string; description?: string }[] }[] = [];
  userPermissionsData: { roles: string[]; rolePermissions: string[]; grants: string[]; denies: string[]; effective: string[] } | null = null;
  initialOverrides: Record<string, 'grant' | 'deny' | 'inherit'> = {};
  localOverrides: Record<string, 'grant' | 'deny' | 'inherit'> = {};

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
        console.error('Lỗi tải danh sách người dùng:', err);
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
      alert('Vui lòng điền đầy đủ thông tin tài khoản!');
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
            alert('Tạo tài khoản thành công nhưng không lấy được ID để phân quyền!');
            this.closeCreateModal();
            this.loadUsers();
          }
          return;
        }

        this.proceedWithRoleUpdate(userId, role);
      },
      error: (err) => {
        console.error('Lỗi tạo tài khoản:', err);
        const msg = err?.error?.message || 'Không thể tạo tài khoản mới. Vui lòng kiểm tra lại thông tin!';
        alert(msg);
      }
    });
  }

  proceedWithRoleUpdate(userId: string, role: string) {
    // Step 2: Elevate role if selected role is not 'User'
    if (role !== 'User') {
      this.http.put(`/api/admin/users/${userId}/role`, { role }).subscribe({
        next: () => {
          alert(`Tạo tài khoản thành công với quyền ${role}!`);
          this.closeCreateModal();
          this.loadUsers();
        },
        error: (err) => {
          console.error('Lỗi phân quyền sau đăng ký:', err);
          alert('Đã tạo tài khoản thành công nhưng gặp lỗi phân quyền. Bạn hãy phân quyền thủ công trong danh sách!');
          this.closeCreateModal();
          this.loadUsers();
        }
      });
    } else {
      alert('Tạo tài khoản học viên (User) thành công!');
      this.closeCreateModal();
      this.loadUsers();
    }
  }

  // Edit Role
  openRoleModal(user: any) {
    this.selectedUser = user;
    this.roleForm = {
      role: user.role
    };
    this.isRoleModalOpen = true;
    this.cdr.detectChanges();
  }

  closeRoleModal() {
    this.isRoleModalOpen = false;
    this.selectedUser = null;
    this.cdr.detectChanges();
  }

  saveRole() {
    if (!this.selectedUser) return;
    const { role } = this.roleForm;

    this.http.put<any>(`/api/admin/users/${this.selectedUser.id}/role`, { role }).subscribe({
      next: () => {
        alert('Cập nhật quyền hạn thành công!');
        this.closeRoleModal();
        this.loadUsers();
      },
      error: (err) => {
        console.error('Lỗi cập nhật quyền:', err);
        const msg = err?.error?.message || 'Không thể cập nhật quyền!';
        alert(msg);
      }
    });
  }

  // Lock / Unlock
  toggleLock(user: any) {
    this.selectedUser = user;
    if (user.isLocked) {
      if (confirm(`Bạn có chắc muốn mở khóa tài khoản ${user.username}?`)) {
        this.http.patch<any>(`/api/admin/users/${user.id}/unlock`, {}).subscribe({
          next: () => {
            alert('Mở khóa tài khoản thành công!');
            this.loadUsers();
          },
          error: (err) => {
            console.error('Lỗi mở khóa:', err);
            alert('Không thể mở khóa tài khoản!');
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
    const reason = this.lockForm.reason.trim() || 'Vi phạm chính sách';

    this.http.patch<any>(`/api/admin/users/${this.selectedUser.id}/lock`, { reason }).subscribe({
      next: () => {
        alert('Khóa tài khoản thành công!');
        this.closeLockModal();
        this.loadUsers();
      },
      error: (err) => {
        console.error('Lỗi khóa tài khoản:', err);
        alert('Không thể khóa tài khoản!');
      }
    });
  }

  onAvatarError(event: Event) {
    const img = event.target as HTMLImageElement;
    if (img) img.src = 'assets/images/default-avatar.svg';
  }

  // --- PERMISSIONS ---

  openPermissionsModal(user: any) {
    this.selectedUser = user;
    this.isPermissionsModalOpen = true;
    this.isLoadingPermissions = true;
    this.permissionCatalog = [];
    this.userPermissionsData = null;
    this.initialOverrides = {};
    this.localOverrides = {};
    this.cdr.detectChanges();

    forkJoin({
      catalog: this.http.get<any>('/api/admin/permissions'),
      userPerms: this.http.get<any>(`/api/admin/users/${user.id}/permissions`)
    }).subscribe({
      next: ({ catalog, userPerms }) => {
        this.permissionCatalog = catalog?.data || [];
        this.userPermissionsData = userPerms?.data || null;

        if (this.userPermissionsData) {
          for (const g of this.userPermissionsData.grants) {
            this.initialOverrides[g] = 'grant';
          }
          for (const d of this.userPermissionsData.denies) {
            this.initialOverrides[d] = 'deny';
          }
        }
        this.localOverrides = { ...this.initialOverrides };
        this.isLoadingPermissions = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi tải quyền hạn:', err);
        this.isLoadingPermissions = false;
        this.cdr.detectChanges();
      }
    });
  }

  closePermissionsModal() {
    this.isPermissionsModalOpen = false;
    this.selectedUser = null;
    this.permissionCatalog = [];
    this.userPermissionsData = null;
    this.initialOverrides = {};
    this.localOverrides = {};
    this.cdr.detectChanges();
  }

  getPermissionLocalState(permName: string): 'grant' | 'deny' | 'inherit' {
    return this.localOverrides[permName] || 'inherit';
  }

  isPermissionFromRole(permName: string): boolean {
    return this.userPermissionsData?.rolePermissions?.includes(permName) ?? false;
  }

  setPermissionLocalState(permName: string, state: 'grant' | 'deny' | 'inherit') {
    if (state === 'inherit') {
      delete this.localOverrides[permName];
    } else {
      this.localOverrides[permName] = state;
    }
    this.cdr.detectChanges();
  }

  hasPermissionChanges(): boolean {
    const allKeys = new Set([...Object.keys(this.initialOverrides), ...Object.keys(this.localOverrides)]);
    for (const key of allKeys) {
      const initial = this.initialOverrides[key] || 'inherit';
      const local = this.localOverrides[key] || 'inherit';
      if (initial !== local) return true;
    }
    return false;
  }

  savePermissions() {
    if (!this.selectedUser) return;

    const changedItems: { permission: string; state: string }[] = [];
    const allKeys = new Set([...Object.keys(this.initialOverrides), ...Object.keys(this.localOverrides)]);
    for (const key of allKeys) {
      const initial = this.initialOverrides[key] || 'inherit';
      const local = this.localOverrides[key] || 'inherit';
      if (initial !== local) {
        changedItems.push({ permission: key, state: local });
      }
    }

    if (changedItems.length === 0) {
      this.closePermissionsModal();
      return;
    }

    this.isSavingPermissions = true;
    this.cdr.detectChanges();

    this.http.put<any>(`/api/admin/users/${this.selectedUser.id}/permissions`, { items: changedItems }).subscribe({
      next: () => {
        this.isSavingPermissions = false;
        alert('Cập nhật quyền hạn thành công!');
        this.closePermissionsModal();
        this.loadUsers();
      },
      error: (err) => {
        this.isSavingPermissions = false;
        console.error('Lỗi lưu quyền hạn:', err);
        const msg = err?.error?.message || 'Không thể lưu quyền hạn!';
        alert(msg);
        this.cdr.detectChanges();
      }
    });
  }
}
