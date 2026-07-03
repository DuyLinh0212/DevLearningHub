import { Component, inject, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ForumService } from '../../../core/services/forum.service';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-post-create',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './post-create.html',
  styleUrl: './post-create.css'
})
export class PostCreateComponent implements OnInit {
  private forumService = inject(ForumService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);
  private http = inject(HttpClient);

  // Form states
  title: string = '';
  bodyMarkdown: string = '';
  imageUrl: string = '';
  selectedTagIds: string[] = [];
  
  tags: any[] = [];
  tagsLoading: boolean = false;
  isSaving: boolean = false;
  
  isEditMode: boolean = false;
  postId: string = '';
  

  // Dropdown & File upload states
  isTagDropdownOpen: boolean = false;
  selectedFile: File | null = null;
  localFileUrl: string = '';
  isUploadingImage: boolean = false;

  ngOnInit() {
    // Kiểm tra token trước khi cho phép vào trang tạo/sửa
    const hasToken = typeof window !== 'undefined' && Boolean(localStorage.getItem('accessToken') || localStorage.getItem('token'));
    if (!hasToken) {
      alert('Vui lòng đăng nhập để đăng bài viết!');
      this.router.navigate(['/login']);
      return;
    }

    this.http.get<any>('/api/users/me').subscribe({
      next: (res) => {
        const user = res?.data || res;
        const perms = (user.permissions || []).map((p: string) => (p || '').toLowerCase());
        const hasPermission = perms.includes('post:create') || perms.includes('post:edit') || perms.includes('system.full_control');
        
        if (!hasPermission) {
          alert('Bạn không có quyền đăng bài viết!');
          this.router.navigate(['/forum']);
          return;
        }

        this.route.params.subscribe(params => {
          this.postId = params['id'] || '';
          if (this.postId) {
            this.isEditMode = true;
            this.loadPostForEdit();
          }
          this.loadTags();
        });
      },
      error: () => {
        alert('Không thể xác thực quyền truy cập.');
        this.router.navigate(['/forum']);
      }
    });
  }

  loadTags() {
    this.tagsLoading = true;
    this.cdr.detectChanges();

    this.forumService.getTags().subscribe({
      next: (res) => {
        this.tags = res || [];
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

  loadPostForEdit() {
    this.forumService.getPost(this.postId).subscribe({
      next: (res) => {
        if (res) {
          this.title = res.title;
          this.bodyMarkdown = res.bodyMarkdown;
          this.imageUrl = res.imageUrl || '';
          this.selectedTagIds = (res.tags || []).map((t: any) => t.id);
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('Lỗi tải thông tin bài viết cần sửa:', err);
        alert('Không thể tải dữ liệu bài viết để chỉnh sửa.');
        this.router.navigate(['/forum']);
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
      this.forumService.updatePost(this.postId, payload).subscribe({
        next: (res) => {
          if (this.selectedFile) {
            this.isUploadingImage = true;
            this.cdr.detectChanges();
            this.forumService.uploadPostImage(this.postId, this.selectedFile).subscribe({
              next: () => {
                this.isUploadingImage = false;
                this.isSaving = false;
                alert('Cập nhật bài đăng thành công!');
                this.router.navigate(['/forum/post', this.postId]);
              },
              error: (err) => {
                console.error('Lỗi tải ảnh lên Cloudinary:', err);
                alert('Cập nhật bài đăng thành công nhưng không thể tải ảnh lên.');
                this.isUploadingImage = false;
                this.isSaving = false;
                this.router.navigate(['/forum/post', this.postId]);
              }
            });
          } else {
            this.isSaving = false;
            alert('Cập nhật bài đăng thành công!');
            this.router.navigate(['/forum/post', this.postId]);
          }
        },
        error: (err) => {
          console.error('Lỗi cập nhật bài đăng:', err);
          alert('Chỉnh sửa bài đăng thất bại.');
          this.isSaving = false;
          this.cdr.detectChanges();
        }
      });
    } else {
      this.forumService.createPost(payload).subscribe({
        next: (res) => {
          const createdPost = res?.data || res;
          const createdId = createdPost?.id;
          if (createdId && this.selectedFile) {
            this.isUploadingImage = true;
            this.cdr.detectChanges();
            this.forumService.uploadPostImage(createdId, this.selectedFile).subscribe({
              next: () => {
                this.isUploadingImage = false;
                this.isSaving = false;
                alert('Đăng bài thảo luận thành công!');
                this.router.navigate(['/forum/post', createdId]);
              },
              error: (err) => {
                console.error('Lỗi tải ảnh lên Cloudinary:', err);
                alert('Đăng bài thảo luận thành công nhưng không thể tải ảnh lên.');
                this.isUploadingImage = false;
                this.isSaving = false;
                this.router.navigate(['/forum/post', createdId]);
              }
            });
          } else {
            this.isSaving = false;
            alert('Đăng bài thảo luận thành công!');
            const targetId = createdId || res?.id;
            if (targetId) {
              this.router.navigate(['/forum/post', targetId]);
            } else {
              this.router.navigate(['/forum']);
            }
          }
        },
        error: (err) => {
          console.error('Lỗi đăng bài thảo luận:', err);
          alert('Đăng bài đăng thất bại.');
          this.isSaving = false;
          this.cdr.detectChanges();
        }
      });
    }
  }

  cancel() {
    if (confirm('Bạn có chắc muốn hủy bỏ các thay đổi này? Dữ liệu chưa lưu sẽ bị mất.')) {
      if (this.isEditMode) {
        this.router.navigate(['/forum/post', this.postId]);
      } else {
        this.router.navigate(['/forum']);
      }
    }
  }

  // Custom regex-based Markdown parser
  renderMarkdown(markdown: string): string {
    if (!markdown) return '';
    
    // Escape HTML tags to prevent XSS
    let escaped = markdown
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Extract code blocks first to avoid line-break formatting issues inside code blocks
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
    
    // 2. Inline code
    escaped = escaped.replace(/`([^`]+)`/g, '<code class="markdown-inline-code">$1</code>');
    
    // 3. Bold
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // 4. Italic
    escaped = escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // 5. Links
    escaped = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="markdown-link">$1</a>');

    // 6. Paragraph breaks
    escaped = escaped.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');

    // Restore code blocks
    codeBlocks.forEach((html, index) => {
      escaped = escaped.replace(`___CODEBLOCK_${index}___`, html);
    });

    return `<p>${escaped}</p>`;
  }
}
