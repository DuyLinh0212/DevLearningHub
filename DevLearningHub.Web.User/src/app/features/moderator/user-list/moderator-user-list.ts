import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  selector: 'app-moderator-user-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './moderator-user-list.html',
  styleUrl: './moderator-user-list.css'
})
export class ModeratorUserListComponent implements OnInit {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);

  users: any[] = [];
  isLoading = false;
  searchText = '';
  currentPage = 1;
  pageSize = 20;
  totalPages = 1;
  totalCount = 0;
  errorMsg = '';

  userPermissions: string[] = [];
  currentUserId = '';

  ngOnInit() {
    this.loadCurrentUser();
  }

  private loadCurrentUser() {
    this.http.get<any>('/api/users/me').subscribe({
      next: (res) => {
        const user = res?.data || res;
        if (user) {
          this.currentUserId = (user.id || '').toString().toLowerCase();
          this.userPermissions = user.permissions || [];
        }
        // Redirect if no permission
        if (!this.hasPermission('user:view_all')) {
          this.router.navigate(['/dashboard']);
          return;
        }
        this.loadUsers();
      },
      error: () => {
        this.router.navigate(['/login']);
      }
    });
  }

  hasPermission(perm: string): boolean {
    return this.userPermissions.includes('system.full_control') || this.userPermissions.includes(perm);
  }

  loadUsers() {
    this.isLoading = true;
    this.errorMsg = '';
    this.cdr.detectChanges();

    let url = `/api/admin/users?page=${this.currentPage}&pageSize=${this.pageSize}`;
    if (this.searchText.trim()) {
      url += `&search=${encodeURIComponent(this.searchText.trim())}`;
    }

    this.http.get<any>(url).subscribe({
      next: (res) => {
        const data = res?.data;
        const items = data?.items || [];
        this.users = items.map((u: any) => ({
          id: u.id,
          username: u.username || 'N/A',
          fullName: u.fullName || 'Chưa cập nhật',
          email: u.email || 'N/A',
          avatarUrl: u.avatarUrl || '',
          role: u.roles && u.roles.length > 0 ? u.roles[0] : 'User',
          isActive: u.isActive ?? true,
          isLocked: u.isLocked ?? false,
          xpPoints: u.xpPoints || 0,
          createdAt: u.createdAt
        }));
        this.totalCount = data?.totalCount || this.users.length;
        this.totalPages = Math.ceil(this.totalCount / this.pageSize) || 1;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMsg = err?.error?.message || 'Không thể tải danh sách người dùng.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onSearch() {
    this.currentPage = 1;
    this.loadUsers();
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadUsers();
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.loadUsers();
    }
  }

  toggleBan(user: any) {
    // Backend authorization will reject if the user lacks permission.
    const action = user.isLocked ? 'mo khoa' : 'khoa';
    if (!confirm(`Bạn có chắc muốn ${action} tài khoản "${user.username}"?`)) return;

    const endpoint = user.isLocked
      ? `/api/admin/users/${user.id}/unlock`
      : `/api/admin/users/${user.id}/lock`;

    this.http.post<any>(endpoint, {}).subscribe({
      next: () => {
        user.isLocked = !user.isLocked;
        alert(`Đã ${action} tài khoản thành công.`);
        this.cdr.detectChanges();
      },
      error: (err) => {
        alert(err?.error?.message || `Không thể ${action} tài khoản.`);
      }
    });
  }

  viewProfile(user: any) {
    this.router.navigate(['/user', user.id]);
  }

  getRoleBadgeClass(role: string): string {
    switch ((role || '').toLowerCase()) {
      case 'admin': return 'badge-admin';
      case 'moderator': return 'badge-moderator';
      default: return 'badge-user';
    }
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('vi-VN');
  }
}
