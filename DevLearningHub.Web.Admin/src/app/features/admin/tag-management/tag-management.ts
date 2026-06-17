import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar';
import { MobileMenuService } from '../../../core/services/mobile-menu.service';

@Component({
  selector: 'app-tag-management',
  standalone: true,
  imports: [CommonModule, SidebarComponent, FormsModule],
  templateUrl: './tag-management.html',
  styleUrl: './tag-management.css'
})
export class TagManagementComponent implements OnInit {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  public mobileMenu = inject(MobileMenuService);

  tags: any[] = [];
  filteredTags: any[] = [];
  searchText = '';
  isLoading = true;

  isTagModalOpen = false;
  isEditing = false;
  editingTagId = '';

  tagForm = {
    name: '',
    colorHex: '#6366f1'
  };

  ngOnInit() {
    this.loadTags();
  }

  loadTags() {
    this.isLoading = true;
    this.http.get<any>('/api/tags').subscribe({
      next: (res) => {
        const data = res?.data || res;
        this.tags = Array.isArray(data) ? data : [];
        this.filteredTags = [...this.tags];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi tải tags:', err);
        this.isLoading = false;
        this.tags = [];
        this.filteredTags = [];
        this.cdr.detectChanges();
      }
    });
  }

  filterTags() {
    const q = this.searchText.trim().toLowerCase();
    if (!q) {
      this.filteredTags = [...this.tags];
      return;
    }
    this.filteredTags = this.tags.filter(t =>
      (t.name || '').toLowerCase().includes(q) ||
      (t.slug || '').toLowerCase().includes(q)
    );
  }

  openTagModal(tag: any = null) {
    if (tag) {
      this.isEditing = true;
      this.editingTagId = tag.id;
      this.tagForm = { name: tag.name || '', colorHex: tag.colorHex || '#6366f1' };
    } else {
      this.isEditing = false;
      this.editingTagId = '';
      this.tagForm = { name: '', colorHex: '#6366f1' };
    }
    this.isTagModalOpen = true;
    this.cdr.detectChanges();
  }

  closeTagModal() {
    this.isTagModalOpen = false;
    this.cdr.detectChanges();
  }

  saveTag() {
    const name = this.tagForm.name.trim();
    if (!name) {
      alert('Vui lòng nhập tên tag!');
      return;
    }

    const colorHex = this.tagForm.colorHex || '#6366f1';
    const payload = { name, colorHex };

    const req$ = this.isEditing && this.editingTagId
      ? this.http.put<any>(`/api/tags/${this.editingTagId}`, payload)
      : this.http.post<any>('/api/tags', payload);

    req$.subscribe({
      next: () => {
        this.loadTags();
        this.closeTagModal();
        alert(this.isEditing ? 'Cập nhật tag thành công!' : 'Tạo tag mới thành công!');
      },
      error: (err) => {
        console.error('Lỗi lưu tag:', err);
        const msg = err.error?.message || err.error?.title || 'Không thể lưu tag.';
        alert(`Lỗi ${err.status}: ${msg}`);
      }
    });
  }

  deleteTag(tagId: string) {
    if (!confirm('Xóa tag này sẽ gỡ nó khỏi tất cả bài viết liên quan. Bạn chắc chắn muốn xóa?')) return;

    this.http.delete<any>(`/api/tags/${tagId}`).subscribe({
      next: () => {
        this.tags = this.tags.filter(t => t.id !== tagId);
        this.filterTags();
        this.cdr.detectChanges();
        alert('Đã xóa tag thành công!');
      },
      error: (err) => {
        console.error('Lỗi xóa tag:', err);
        alert(`Lỗi ${err.status}: Không thể xóa tag này.`);
      }
    });
  }
}
