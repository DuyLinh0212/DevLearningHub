import { Component, inject, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-admin-post-create',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './post-create.html',
  styleUrl: './post-create.css'
})
export class AdminPostCreateComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);

  // Edit mode: this same screen doubles as the "Sửa bài" form when a post id is
  // present in the route (/admin/posts/:id/edit). Empty id => create mode.
  editingPostId: string | null = null;
  get isEditMode(): boolean {
    return !!this.editingPostId;
  }

  // Form states
  title = '';
  bodyMarkdown = '';
  imageUrl = '';
  selectedTagIds: string[] = [];

  tags: any[] = [];
  tagsLoading = false;
  isSaving = false;
  isLoadingPost = false;

  // Dropdown & File upload states
  isTagDropdownOpen = false;
  selectedFile: File | null = null;
  localFileUrl = '';
  isUploadingImage = false;

  ngOnInit() {
    this.loadTags();

    // If the route carries a post id, switch to edit mode and prefill the form.
    this.editingPostId = this.route.snapshot.paramMap.get('id');
    if (this.editingPostId) {
      this.loadPostForEdit(this.editingPostId);
    }
  }

  private loadPostForEdit(id: string) {
    this.isLoadingPost = true;
    this.cdr.detectChanges();
    this.http.get<any>(`/api/posts/${id}`).subscribe({
      next: (res) => {
        const post = res?.data || res;
        if (post) {
          this.title = post.title || '';
          this.bodyMarkdown = post.bodyMarkdown || '';
          this.imageUrl = post.imageUrl || '';
          // Post detail returns full tag objects; keep only their ids for the picker.
          this.selectedTagIds = (post.tags || []).map((t: any) => t.id).filter(Boolean);
        }
        this.isLoadingPost = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi tải bài viết để sửa:', err);
        alert(`Lỗi ${err.status || '?'}: Không thể tải bài viết cần sửa.`);
        this.isLoadingPost = false;
        this.router.navigate(['/admin/posts']);
      }
    });
  }

  loadTags() {
    this.tagsLoading = true;
    this.http.get<any>('/api/tags').subscribe({
      next: (res) => {
        const data = res?.data || res || [];
        this.tags = Array.isArray(data) ? data : [];
        this.tagsLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi tải danh mục tags:', err);
        this.tagsLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  toggleTagDropdown(event: Event) {
    event.stopPropagation();
    this.isTagDropdownOpen = !this.isTagDropdownOpen;
    this.cdr.detectChanges();
  }

  @HostListener('document:click')
  closeTagDropdown() {
    this.isTagDropdownOpen = false;
    this.cdr.detectChanges();
  }

  getTagById(tagId: string): any {
    return this.tags.find(t => t.id === tagId);
  }

  removeTagSelection(tagId: string, event: Event) {
    event.stopPropagation();
    const idx = this.selectedTagIds.indexOf(tagId);
    if (idx > -1) {
      this.selectedTagIds.splice(idx, 1);
    }
    this.cdr.detectChanges();
  }

  toggleTagSelection(tagId: string) {
    const idx = this.selectedTagIds.indexOf(tagId);
    if (idx > -1) {
      this.selectedTagIds.splice(idx, 1);
    } else {
      this.selectedTagIds.push(tagId);
    }
    this.cdr.detectChanges();
  }

  isTagSelected(tagId: string): boolean {
    return this.selectedTagIds.includes(tagId);
  }

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn tệp tin hình ảnh!');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Kích thước ảnh không được vượt quá 5MB!');
      return;
    }

    this.selectedFile = file;
    this.localFileUrl = URL.createObjectURL(file);
    this.cdr.detectChanges();
  }

  clearImage(event: Event) {
    event.stopPropagation();
    this.selectedFile = null;
    this.localFileUrl = '';
    this.imageUrl = '';
    this.cdr.detectChanges();
  }

  submitForm() {
    if (!this.title.trim() || !this.bodyMarkdown.trim() || this.selectedTagIds.length === 0) {
      alert('Vui lòng điền đầy đủ tiêu đề, nội dung và chọn ít nhất 1 thẻ phân loại!');
      return;
    }

    this.isSaving = true;
    this.cdr.detectChanges();

    const payload = {
      title: this.title.trim(),
      bodyMarkdown: this.bodyMarkdown.trim(),
      imageUrl: this.imageUrl.trim() || undefined,
      tagIds: this.selectedTagIds
    };

    if (this.isEditMode) {
      this.submitEdit(payload);
      return;
    }

    this.http.post<any>('/api/posts', payload).subscribe({
      next: (res) => {
        const createdPost = res?.data || res;
        const createdId = createdPost?.id;
        if (createdId && this.selectedFile) {
          this.isUploadingImage = true;
          this.cdr.detectChanges();
          this.uploadPostImage(createdId, this.selectedFile).subscribe({
            next: () => {
              this.isUploadingImage = false;
              this.isSaving = false;
              alert('Đăng bài viết thành công!');
              this.router.navigate(['/admin/posts', createdId]);
            },
            error: (err) => {
              console.error('Lỗi tải ảnh lên Cloudinary:', err);
              alert('Đăng bài viết thành công nhưng không thể tải ảnh lên.');
              this.isUploadingImage = false;
              this.isSaving = false;
              this.router.navigate(['/admin/posts', createdId]);
            }
          });
        } else {
          this.isSaving = false;
          alert('Đăng bài viết thành công!');
          const targetId = createdId || res?.id;
          if (targetId) {
            this.router.navigate(['/admin/posts', targetId]);
          } else {
            this.router.navigate(['/admin/posts']);
          }
        }
      },
      error: (err) => {
        console.error('Lỗi đăng bài viết:', err);
        alert(`Lỗi ${err.status}: Đăng bài viết thất bại.`);
        this.isSaving = false;
        this.cdr.detectChanges();
      }
    });
  }

  // Edit an existing post via PUT /api/posts/{id} (backend enforces post:edit_any
  // for non-authors). If a new local image file was picked, upload it afterwards.
  private submitEdit(payload: any) {
    const id = this.editingPostId!;
    this.http.put<any>(`/api/posts/${id}`, payload).subscribe({
      next: () => {
        if (this.selectedFile) {
          this.isUploadingImage = true;
          this.cdr.detectChanges();
          this.uploadPostImage(id, this.selectedFile).subscribe({
            next: () => {
              this.isUploadingImage = false;
              this.isSaving = false;
              alert('Cập nhật bài viết thành công!');
              this.router.navigate(['/admin/posts', id]);
            },
            error: (err) => {
              console.error('Lỗi tải ảnh lên Cloudinary:', err);
              alert('Cập nhật bài viết thành công nhưng không thể tải ảnh lên.');
              this.isUploadingImage = false;
              this.isSaving = false;
              this.router.navigate(['/admin/posts', id]);
            }
          });
        } else {
          this.isSaving = false;
          alert('Cập nhật bài viết thành công!');
          this.router.navigate(['/admin/posts', id]);
        }
      },
      error: (err) => {
        console.error('Lỗi cập nhật bài viết:', err);
        alert(`Lỗi ${err.status}: Cập nhật bài viết thất bại.`);
        this.isSaving = false;
        this.cdr.detectChanges();
      }
    });
  }

  private uploadPostImage(id: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<any>(`/api/posts/${id}/image`, formData);
  }

  cancel() {
    if (confirm('Bạn có chắc muốn hủy bỏ các thay đổi này? Dữ liệu chưa lưu sẽ bị mất.')) {
      this.router.navigate(['/admin/posts']);
    }
  }

  // Custom regex-based Markdown parser
  renderMarkdown(markdown: string): string {
    if (!markdown) return '';

    let escaped = markdown
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const codeBlocks: string[] = [];
    const codeBlockRegex = /```([a-zA-Z0-9+#-]+)?\s*([\s\S]*?)\s*```/g;

    escaped = escaped.replace(codeBlockRegex, (match, lang, code) => {
      const index = codeBlocks.length;
      const cleanCode = code.trim();
      const languageClass = lang ? ` lang-${lang}` : '';
      const badge = lang ? `<span class="code-badge">${lang.toUpperCase()}</span>` : '';
      codeBlocks.push(`<div class="code-block-wrapper">${badge}<pre class="markdown-code-block${languageClass}"><code>${cleanCode}</code></pre></div>`);
      return `___CODEBLOCK_${index}___`;
    });

    escaped = escaped.replace(/`([^`]+)`/g, '<code class="markdown-inline-code">$1</code>');
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    escaped = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="markdown-link">$1</a>');
    escaped = escaped.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');

    codeBlocks.forEach((html, index) => {
      escaped = escaped.replace(`___CODEBLOCK_${index}___`, html);
    });

    return `<p>${escaped}</p>`;
  }
}
