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
  bio: string = '';
  avatarUrl: string = '';
  isSaving: boolean = false;

  ngOnInit() {
    this.loadUserProfile();
  }

  loadUserProfile() {
    this.http.get<any>('/api/users/me').subscribe({
      next: (res) => {
        const user = res?.data || res;
        if (user) {
          this.email = user.email || user.Email || '';
          this.avatarUrl = user.avatarUrl || user.AvatarUrl || 'assets/images/default-avatar.svg';
          this.bio = user.bio || user.Bio || 'Chưa cập nhật tiểu sử.';
          
          // Bốc quyền động từ API của Nam
          const rawRole = user.role || (user.roles && user.roles[0]) || 'Học viên';
          this.role = rawRole.toLowerCase() === 'admin' ? 'Quản trị viên' : 'Học viên';
          
          if (user.fullName || user.FullName) {
            const fullName = (user.fullName || user.FullName).trim();
            const nameParts = fullName.split(' ');
            this.firstName = nameParts.pop() || '';
            this.lastName = nameParts.join(' ');
          }
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('Không thể lấy thông tin profile:', err);
      }
    });
  }

  saveChanges() {
    if (this.isSaving) return;
    this.isSaving = true;

    const combinedFullName = `${this.lastName.trim()} ${this.firstName.trim()}`.trim();

    const updatePayload = {
      fullName: combinedFullName,
      avatarUrl: this.avatarUrl,
      bio: this.bio.trim() 
    };

    this.http.put<any>('/api/users/me', updatePayload).subscribe({
      next: () => {
        this.isSaving = false;
        alert('Cập nhật hồ sơ thành công!');
        this.loadUserProfile();
      },
      error: (err) => {
        this.isSaving = false;
        alert(`Lưu cấu hình thất bại! (Mã lỗi: ${err.status})`);
        console.error(err);
      }
    });
  }

  changeAvatar() {
    const newUrl = prompt('Nhập URL ảnh đại diện mới:', this.avatarUrl);
    if (newUrl !== null && newUrl.trim() !== '') {
      this.avatarUrl = newUrl.trim();
      this.cdr.detectChanges();
    }
  }
}