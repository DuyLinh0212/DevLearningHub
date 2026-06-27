import { Component, inject, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { StaffUserService } from '../../../core/services/staff-user.service';
import { MobileMenuService } from '../../../core/services/mobile-menu.service';
import { AuthService } from '../../../core/services/auth.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-admin-post-detail',
  standalone: true,
  imports: [RouterLink, CommonModule, FormsModule, NgTemplateOutlet],
  templateUrl: './post-detail.html',
  styleUrl: './post-detail.css'
})
export class AdminPostDetailComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  public mobileMenu = inject(MobileMenuService);
  private staffUserService = inject(StaffUserService);
  private authService = inject(AuthService);
  private sanitizer = inject(DomSanitizer);

  postId: string = '';
  post: any = null;
  comments: any[] = [];
  loading: boolean = false;

  // Form states
  rootCommentText: string = '';
  replyCommentText: string = '';
  replyingCommentId: string | null = null;
  activeCommentActionId: string | null = null;

  // Lightbox zoom state
  zoomedImageUrl: string | null = null;
  imageZoomLevel = 1;
  imageTranslateX = 0;
  imageTranslateY = 0;
  isImageDragging = false;
  private imageDragStartX = 0;
  private imageDragStartY = 0;
  private imageDragBaseX = 0;
  private imageDragBaseY = 0;

  // User roles and permissions
  currentUserRoles: string[] = [];
  currentUserId: string = '';
  canModerateComments: boolean = false;
  canModeratePosts: boolean = false;

  ngOnInit() {
    this.loadCurrentUser();
    this.staffUserService.ensureLoaded().subscribe(() => {
      this.route.params.subscribe(params => {
        this.postId = params['id'] || '';
        if (this.postId) {
          this.loadPostDetails();
        }
      });
    });
  }

  loadCurrentUser() {
    this.authService.getCurrentUser().subscribe({
      next: (user) => {
        this.currentUserRoles = user.roles || [];
        this.currentUserId = user.id || '';
        this.canModerateComments = user.permissions?.includes('comment:hide') ||
                                    this.currentUserRoles.includes('moderator') ||
                                    this.currentUserRoles.includes('admin');
        this.canModeratePosts = this.currentUserRoles.includes('admin') ||
                                this.currentUserRoles.includes('moderator') ||
                                user.permissions?.includes('post:delete');
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi tải thông tin user:', err);
      }
    });
  }

  loadPostDetails() {
    this.loading = true;
    this.cdr.detectChanges();

    this.http.get<any>(`/api/posts/${this.postId}`).subscribe({
      next: (res) => {
        this.post = res?.data || res;
        if (this.post?.isHidden) {
          document.title = `[Đã ẩn] ${this.post.title}`;
        } else if (this.post) {
          document.title = this.post.title;
        }
        // Annotate post author with staff info
        if (this.post?.author) {
          const authorInfo = this.staffUserService.getStaffInfo(this.post.author);
          this.post.author = {
            ...this.post.author,
            isStaff: authorInfo !== null,
            isAdmin: authorInfo?.roles.includes('admin') || false
          };
        }
        this.loadComments();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi tải bài viết chi tiết:', err);
        if (err.status === 403) {
          alert('Bài viết đang bị ẩn. Vui lòng đăng nhập tài khoản Admin/Moderator để xem.');
        }
        this.post = null;
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadComments() {
    this.http.get<any>(`/api/posts/${this.postId}/comments?showHidden=true`).subscribe({
      next: (res) => {
        const raw = res?.data || res || [];
        let arr = Array.isArray(raw) ? raw : [];
        // Lọc bỏ bình luận mồ côi ở gốc nhưng có parentId
        arr = arr.filter((c: any) => !c.parentId);
        this.comments = this.staffUserService.annotateComments(arr);
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi tải bình luận:', err);
        this.comments = [];
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  votePost(voteType: 'up' | 'down') {
    if (!this.post) return;
    this.http.post<any>(`/api/posts/${this.post.id}/vote`, { voteType }).subscribe({
      next: (res) => {
        if (res && this.post) {
          this.post.upvotes = res.upvotes;
          this.post.downvotes = res.downvotes;
          this.post.myVote = res.myVote;
          this.cdr.detectChanges();
        }
      },
      error: (err) => console.error('Lỗi bình chọn bài viết:', err)
    });
  }

  scrollToComments() {
    const element = document.querySelector('.discussion-section');
    if (element) element.scrollIntoView({ behavior: 'smooth' });
  }

  voteComment(comment: any, voteType: 'up' | 'down') {
    this.http.post<any>(`/api/comments/${comment.id}/vote`, { voteType }).subscribe({
      next: (res) => {
        if (res) {
          comment.upvotes = res.upvotes;
          comment.downvotes = res.downvotes;
          comment.myVote = res.myVote;
          this.cdr.detectChanges();
        }
      },
      error: (err) => console.error('Lỗi bình chọn bình luận:', err)
    });
  }

  addRootComment() {
    if (!this.rootCommentText.trim() || !this.post) return;
    const payload = { bodyMarkdown: this.rootCommentText.trim() };
    this.http.post<any>(`/api/posts/${this.postId}/comments`, payload).subscribe({
      next: () => {
        this.rootCommentText = '';
        if (this.post) this.post.commentCount += 1;
        this.loadComments();
      },
      error: (err) => {
        console.error('Lỗi gửi bình luận:', err);
        alert('Có lỗi xảy ra khi gửi bình luận.');
      }
    });
  }

  toggleReplyForm(commentId: string | null) {
    this.replyingCommentId = commentId;
    this.replyCommentText = '';
    this.cdr.detectChanges();
  }

  addReplyComment(parentId: string) {
    if (!this.replyCommentText.trim() || !this.post) return;
    const payload = { bodyMarkdown: this.replyCommentText.trim(), parentId: parentId };
    this.http.post<any>(`/api/posts/${this.postId}/comments`, payload).subscribe({
      next: () => {
        this.replyingCommentId = null;
        this.replyCommentText = '';
        if (this.post) this.post.commentCount += 1;
        this.loadComments();
      },
      error: (err) => {
        console.error('Lỗi gửi phản hồi:', err);
        alert('Có lỗi xảy ra khi gửi câu trả lời.');
      }
    });
  }

  deleteComment(commentId: string) {
    if (!confirm('Bạn có chắc chắn muốn xóa bình luận này và toàn bộ bình luận con của nó không?')) return;
    this.http.delete<any>(`/api/comments/${commentId}`).subscribe({
      next: () => {
        alert('Đã xóa bình luận thành công.');
        this.loadPostDetails();
      },
      error: (err) => {
        console.error('Lỗi xóa bình luận:', err);
        alert('Không thể xóa bình luận.');
      }
    });
  }

  toggleModeratePost() {
    if (!this.post) return;
    const hide = !this.post.isHidden;
    const reason = prompt(hide ? 'Nhập lý do ẩn bài viết:' : 'Nhập lý do hiện lại bài viết:');
    if (reason === null) return;
    this.http.post<any>(`/api/posts/${this.postId}/moderate`, { reason: reason.trim(), hidden: hide }).subscribe({
      next: () => {
        this.post.isHidden = hide;
        alert(hide ? 'Đã ẩn bài đăng thành công.' : 'Đã hiện lại bài đăng thành công.');
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi kiểm duyệt bài viết:', err);
        alert('Không thể hoàn tất hành động kiểm duyệt.');
      }
    });
  }

  toggleModerateComment(comment: any) {
    const hide = !comment.isHidden;
    const reason = prompt(hide ? 'Nhập lý do ẩn bình luận:' : 'Nhập lý do hiện lại bình luận:');
    if (reason === null) return;
    this.http.post<any>(`/api/comments/${comment.id}/moderate`, { reason: reason.trim(), hidden: hide }).subscribe({
      next: () => {
        comment.isHidden = hide;
        alert(hide ? 'Đã ẩn bình luận thành công.' : 'Đã hiện lại bình luận thành công.');
        this.loadComments();
      },
      error: (err) => {
        console.error('Lỗi kiểm duyệt bình luận:', err);
        alert('Không thể hoàn tất hành động kiểm duyệt.');
      }
    });
  }

  deletePost() {
    if (!confirm('Bạn có chắc chắn muốn xóa hoàn toàn bài viết này? Hành động này không thể hoàn tác.')) return;
    this.http.delete<any>(`/api/posts/${this.postId}`).subscribe({
      next: () => {
        alert('Đã xóa bài viết thành công!');
        this.router.navigate(['/admin/posts']);
      },
      error: (err) => {
        console.error('Lỗi xóa bài viết:', err);
        alert('Không thể xóa bài viết.');
      }
    });
  }

  isPostAuthorComment(comment: any): boolean {
    if (!comment?.author || !this.post?.author) return false;
    return comment.author.id?.toString().toLowerCase() === this.post.author.id?.toString().toLowerCase();
  }

  formatRelativeTime(dateString: string): string {
    if (!dateString) return '';
    const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (seconds < 60) return 'Vừa xong';
    const m = Math.floor(seconds / 60); if (m < 60) return `${m} phút trước`;
    const h = Math.floor(m / 60); if (h < 24) return `${h} giờ trước`;
    const d = Math.floor(h / 24); if (d < 30) return `${d} ngày trước`;
    return `${Math.floor(d / 30)} tháng trước`;
  }

  renderMarkdown(markdown: string): SafeHtml {
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
    
    // 2. Inline code (`code`)
    escaped = escaped.replace(/`([^`]+)`/g, '<code class="markdown-inline-code">$1</code>');
    
    // 3. Bold (**text**)
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // 4. Italic (*text*)
    escaped = escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // 5. Links ([text](url))
    escaped = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="markdown-link">$1</a>');

    // 6. Double newlines to paragraph breaks, single to line breaks
    escaped = escaped.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');

    // Restore code blocks
    codeBlocks.forEach((html, index) => {
      escaped = escaped.replace(`___CODEBLOCK_${index}___`, html);
    });

    return this.sanitizer.bypassSecurityTrustHtml(`<p>${escaped}</p>`);
  }


  onAvatarError(event: Event) {
    const img = event.target as HTMLImageElement;
    if (img) img.src = 'assets/images/default-avatar.svg';
  }

  // Lightbox Zoom Methods
  openImageZoom(url: string) {
    this.zoomedImageUrl = url;
    this.resetImageTransform();
    document.body.style.overflow = 'hidden';
  }

  closeImageZoom() {
    this.zoomedImageUrl = null;
    this.resetImageTransform();
    document.body.style.overflow = '';
  }

  zoomImage(delta: number, event?: Event) {
    if (event) event.stopPropagation();
    this.imageZoomLevel = Math.max(0.5, Math.min(3, +(this.imageZoomLevel + delta).toFixed(2)));
    if (this.imageZoomLevel <= 1) {
      this.imageTranslateX = 0;
      this.imageTranslateY = 0;
    }
  }

  resetImageZoom(event?: Event) {
    if (event) event.stopPropagation();
    this.resetImageTransform();
  }

  resetImageTransform() {
    this.imageZoomLevel = 1;
    this.imageTranslateX = 0;
    this.imageTranslateY = 0;
    this.isImageDragging = false;
  }

  get imageTransform(): string {
    return `translate(${this.imageTranslateX}px, ${this.imageTranslateY}px) scale(${this.imageZoomLevel})`;
  }

  startImageDrag(event: MouseEvent | TouchEvent) {
    if (this.imageZoomLevel <= 1) return;
    event.preventDefault();
    event.stopPropagation();
    const point = this.getDragPoint(event);
    this.isImageDragging = true;
    this.imageDragStartX = point.x;
    this.imageDragStartY = point.y;
    this.imageDragBaseX = this.imageTranslateX;
    this.imageDragBaseY = this.imageTranslateY;
  }

  stopImageDrag() {
    this.isImageDragging = false;
  }

  private moveImageDrag(event: MouseEvent | TouchEvent) {
    if (!this.isImageDragging || this.imageZoomLevel <= 1) return;
    event.preventDefault();
    const point = this.getDragPoint(event);
    this.imageTranslateX = this.imageDragBaseX + point.x - this.imageDragStartX;
    this.imageTranslateY = this.imageDragBaseY + point.y - this.imageDragStartY;
  }

  private getDragPoint(event: MouseEvent | TouchEvent): { x: number; y: number } {
    if ('touches' in event && event.touches.length > 0) {
      return { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }
    return { x: (event as MouseEvent).clientX, y: (event as MouseEvent).clientY };
  }

  @HostListener('document:mousemove', ['$event'])
  onImageDragMove(event: MouseEvent) { this.moveImageDrag(event); }

  @HostListener('document:touchmove', ['$event'])
  onImageTouchMove(event: TouchEvent) { this.moveImageDrag(event); }

  @HostListener('document:mouseup')
  @HostListener('document:touchend')
  onImageDragEnd() { this.stopImageDrag(); }

  @HostListener('document:keydown.escape')
  onEscapeKey() {
    if (this.zoomedImageUrl) this.closeImageZoom();
  }

  toggleCommentActionDropdown(commentId: string, event: MouseEvent) {
    event.stopPropagation();
    if (this.activeCommentActionId === commentId) {
      this.activeCommentActionId = null;
    } else {
      this.activeCommentActionId = commentId;
    }
    this.cdr.detectChanges();
  }

  @HostListener('document:click')
  onGlobalClick() {
    this.activeCommentActionId = null;
  }
}