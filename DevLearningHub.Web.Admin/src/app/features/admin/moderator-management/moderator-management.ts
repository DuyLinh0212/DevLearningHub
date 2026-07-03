import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MobileMenuService } from '../../../core/services/mobile-menu.service';

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
  selector: 'app-moderator-management',
  standalone: true,
  imports: [CommonModule,  FormsModule],
  templateUrl: './moderator-management.html',
  styleUrl: './moderator-management.css'
})
export class ModeratorManagementComponent implements OnInit {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  public mobileMenu = inject(MobileMenuService);

  moderators: any[] = [];
  searchText = '';
  isLoading = false;

  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalCount = 0;
  totalPages = 1;
  pageNumbers: number[] = [];

  // Modals
  isManageModalOpen = false;
  isLoadingManage = false;
  isSavingManage = false;
  manageUser: any = null;
  manageModules: ManageModule[] = [];
  manageChecked: Record<string, boolean> = {};

  // Filter - chỉ show Moderator
  private readonly allowedRoles = ['Moderator'];

  // Danh sách quyền kiểm duyệt chỉ hiển thị cho Moderator
  private readonly moderationPermissions = [
    'comment:hide',
    'comment:delete',
    'post:hide_any',
    'post:edit_any',
    'post:delete_any'
  ];

  ngOnInit() {
    this.loadModerators();
  }

  loadModerators() {
    this.isLoading = true;
    this.cdr.detectChanges();

    let url = `/api/admin/users?page=${this.currentPage}&pageSize=${this.pageSize}&search=${encodeURIComponent(this.searchText.trim())}`;

    this.http.get<any>(url).subscribe({
      next: (res) => {
        const responseData = res?.data;
        const items = responseData?.items || [];

        // Lọc chỉ lấy user có role Moderator
        this.moderators = items
          .filter((u: any) => u.roles?.some((r: string) => r.toLowerCase() === 'moderator'))
          .map((u: any) => ({
            id: u.id,
            username: u.username || 'N/A',
            fullName: u.fullName || 'Chưa cập nhật',
            email: u.email || 'N/A',
            xpPoints: u.xpPoints || 0,
            isActive: u.isActive ?? true,
            isLocked: u.isLocked ?? false,
            createdAt: u.createdAt,
            role: u.roles?.[0] || 'Moderator'
          }));

        this.totalCount = this.moderators.length; // Approximate since filtered
        this.totalPages = Math.max(1, Math.ceil(this.totalCount / this.pageSize));
        this.calculatePageNumbers();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi tải danh sách Moderator:', err);
        this.moderators = [];
        this.totalCount = 0;
        this.totalPages = 1;
        this.calculatePageNumbers();
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  calculatePageNumbers() {
    this.pageNumbers = [];
    for (let i = 1; i <= this.totalPages; i++) {
      this.pageNumbers.push(i);
    }
  }

  onSearchChange() {
    this.currentPage = 1;
    this.loadModerators();
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadModerators();
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  // --- ACTIONS ---

  openManageModal(user: any) {
    this.manageUser = { ...user };
    this.isManageModalOpen = true;
    this.isLoadingManage = true;
    this.manageModules = [];
    this.manageChecked = {};
    this.cdr.detectChanges();

    this.http.get<any>(`/api/admin/users/${user.id}/management`).subscribe({
      next: (res) => {
        const data = res?.data || {};
        this.manageModules = data.permissionModules || [];

        // Chỉ giữ lại permission thuộc nhóm kiểm duyệt
        this.manageModules = this.manageModules.map(mod => ({
          ...mod,
          permissions: mod.permissions.filter(p => this.moderationPermissions.includes(p.name))
        })).filter(mod => mod.permissions.length > 0);

        this.manageChecked = {};
        for (const mod of this.manageModules) {
          for (const perm of mod.permissions) {
            this.manageChecked[perm.name] = !!perm.checked;
          }
        }

        this.isLoadingManage = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi tải dữ liệu quản lý Moderator:', err);
        this.isLoadingManage = false;
        alert(err?.error?.message || 'Không thể tải dữ liệu quyền hạn!');
        this.closeManageModal();
      }
    });
  }

  closeManageModal() {
    this.isManageModalOpen = false;
    this.manageUser = null;
    this.manageModules = [];
    this.manageChecked = {};
    this.cdr.detectChanges();
  }

  togglePermission(name: string) {
    this.manageChecked[name] = !this.manageChecked[name];
  }

  countCheckedInModule(mod: ManageModule): number {
    return (mod.permissions || []).filter(p => this.manageChecked[p.name]).length;
  }

  saveManage() {
    if (!this.manageUser) return;

    // Chỉ lưu permission thuộc nhóm moderation
    const permissions = Object.keys(this.manageChecked)
      .filter(name => this.manageChecked[name] && this.moderationPermissions.includes(name));

    this.isSavingManage = true;
    this.cdr.detectChanges();

    // Giữ nguyên role Moderator
    const payload = {
      role: 'Moderator',
      permissions
    };

    this.http.put<any>(`/api/admin/users/${this.manageUser.id}/management`, payload).subscribe({
      next: () => {
        this.isSavingManage = false;
        alert('Đã cập nhật quyền kiểm duyệt cho Moderator!');
        this.closeManageModal();
        this.loadModerators();
      },
      error: (err) => {
        this.isSavingManage = false;
        console.error('Lỗi lưu quyền Moderator:', err);
        alert(err?.error?.message || 'Không thể lưu quyền hạn!');
        this.cdr.detectChanges();
      }
    });
  }

  // --- Promote User to Moderator ---
  openPromoteModal() {
    // TODO: Implement promote user modal - list of Users to promote to Moderator
    alert('Tính năng thăng cấp User lên Moderator sẽ được thêm sau. Vui lòng dùng nút Quản lý người dùng ở trang User Management.');
  }

  onAvatarError(event: Event) {
    const img = event.target as HTMLImageElement;
    if (img) img.src = 'assets/images/default-avatar.svg';
  }
}
