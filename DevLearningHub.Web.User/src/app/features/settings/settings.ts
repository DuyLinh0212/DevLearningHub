import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './settings.html',
  styleUrl: './settings.css'
})
export class SettingsComponent implements OnInit {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);

  firstName: string = '';
  lastName: string = '';
  email: string = '';
  role: string = 'Học viên';
  avatarUrl: string = '';
  xpPoints: number = 0;
  isSaving: boolean = false;
  isUploadingAvatar: boolean = false;

  ngOnInit() {
    this.loadUserProfile();
  }

  loadUserProfile() {
    this.http.get<any>('/api/users/me').subscribe({
      next: (res) => {
        const user = res?.data || res;
        if (!user) return;

        this.email = user.email || '';
        this.avatarUrl = user.avatarUrl || '';
        this.xpPoints = user.xpPoints || 0;
        this.loadUserStats(user.id);

        const rawRoles = user.roles || [];
        let isAdmin = rawRoles.some((r: string) => r.toLowerCase() === 'admin') || user.role?.toLowerCase() === 'admin';

        if (!isAdmin) {
          try {
            const token = localStorage.getItem('accessToken') || localStorage.getItem('token') || '';
            if (token) {
              const payloadPart = token.split('.')[1];
              const decodedPayload = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')));
              const roleClaim = decodedPayload['role'] || decodedPayload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];

              if (Array.isArray(roleClaim)) {
                isAdmin = roleClaim.map((r: string) => r.toLowerCase()).includes('admin');
              } else if (roleClaim) {
                isAdmin = roleClaim.toLowerCase() === 'admin';
              }
            }
          } catch (tokenError) {
            console.error('Không thể đọc role từ token:', tokenError);
          }
        }

        this.role = isAdmin ? 'Quản trị viên' : 'Học viên';

        if (user.fullName) {
          const fullName = user.fullName.trim();
          const nameParts = fullName.split(' ');
          this.firstName = nameParts.pop() || '';
          this.lastName = nameParts.join(' ');
        } else {
          this.firstName = user.username || '';
          this.lastName = '';
        }

        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Không thể tải hồ sơ người dùng:', err);
        this.role = 'Học viên';
        this.cdr.detectChanges();
      }
    });
  }

  private loadUserStats(userId: string) {
    if (!userId) return;

    this.http.get<any>(`/api/users/${userId}/stats`).subscribe({
      next: (res) => {
        const stats = res?.data || res;
        this.xpPoints = stats?.totalXP ?? this.xpPoints;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cdr.detectChanges();
      }
    });
  }

  saveChanges() {
    if (this.isSaving) return;
    this.isSaving = true;

    const combinedFullName = `${this.lastName.trim()} ${this.firstName.trim()}`.trim();
    const updatePayload = {
      fullName: combinedFullName,
      avatarUrl: this.avatarUrl
    };

    this.http.put<any>('/api/users/me', updatePayload).subscribe({
      next: () => {
        this.isSaving = false;
        alert('Cập nhật hồ sơ thành công!');
        window.dispatchEvent(new Event('profile-updated'));
        this.loadUserProfile();
      },
      error: (err) => {
        this.isSaving = false;
        alert(`Lưu thất bại! (Mã lỗi: ${err.status})`);
      }
    });
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || this.isUploadingAvatar) return;

    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn đúng file ảnh!');
      input.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Dung lượng ảnh không được vượt quá 5MB!');
      input.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    this.isUploadingAvatar = true;

    this.http.post<any>('/api/users/me/avatar', formData).subscribe({
      next: (res) => {
        const user = res?.data || res;
        this.avatarUrl = user?.avatarUrl || '';
        this.isUploadingAvatar = false;
        input.value = '';
        window.dispatchEvent(new Event('profile-updated'));
        alert('Cập nhật ảnh đại diện thành công!');
        this.cdr.detectChanges();
      },
      error: (err) => {
        const message = err?.error?.message || `Upload ảnh thất bại! (Mã lỗi: ${err.status})`;
        alert(message);
        this.isUploadingAvatar = false;
        input.value = '';
        this.cdr.detectChanges();
      }
    });
  }
}
