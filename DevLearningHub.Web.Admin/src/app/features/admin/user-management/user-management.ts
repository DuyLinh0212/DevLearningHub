import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
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

  rolesList = ['Admin', 'Moderator', 'User'];

  // Manage modal (role + permissions combined) — matches the admin "Quản lý User" screen.
  isManageModalOpen = false;
  isLoadingManage = false;
  isSavingManage = false;
  manageUser: any = null;
  manageRoles: ManageRoleOption[] = [];
  manageModules: ManageModule[] = [];
  manageSelectedRole = 'User';
  manageChecked: Record<string, boolean> = {};

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

  countCheckedInModule(mod: ManageModule): number {
    return mod.permissions.filter(p => this.manageChecked[p.name]).length;
  }

  saveManage() {
    if (!this.manageUser) return;
    if (!this.manageSelectedRole) {
      alert('Vui lòng chọn vai trò cho người dùng!');
      return;
    }

    const permissions = Object.keys(this.manageChecked).filter(name => this.manageChecked[name]);

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
