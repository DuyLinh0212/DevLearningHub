import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar';
import { StaffUserService } from '../../../core/services/staff-user.service';
import { MobileMenuService } from '../../../core/services/mobile-menu.service';

@Component({
  selector: 'app-admin-post-detail',
  standalone: true,
  imports: [RouterLink, CommonModule, FormsModule, NgTemplateOutlet, SidebarComponent],
  templateUrl: './post-detail.html',
  styleUrl: './post-detail.css'
})
export class AdminPostDetailComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  public mobileMenu = inject(MobileMenuService);
  private sanitizer = inject(DomSanitizer);
  private staffUserService = inject(StaffUserService);

  postId: string = '';
  post: any = null;
  comments: any[] = [];

  loading: boolean = false;

  // Form states
  rootCommentText: string = '';
  replyCommentText: string = '';

  replyingCommentId: string | null = null;

  zoomedImageUrl: string | null = null;

  ngOnInit() {
    this.staffUserService.ensureLoaded().subscribe(() => {
      this.route.params.subscribe(params => {
        this.postId = params['id'] || '';
        if (this.postId) {
          this.loadPostDetails();
        }
      });
    });
  }

  loadPostDetails() {
    this.loading = true;
    this.cdr.detectChanges();

    this.http.get<any>(`/api/posts/${this.postId}`).subscribe({
      next: (res) => {
        this.post = res?.data || res;
        if (this.post?.isHidden) {
          document.title = `[Đã ẩn] ${this.post.title || 'Bài viết'}`;
        }
        this.loadComments();
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
        this.comments = this.staffUserService.annotateComments(Array.isArray(raw) ? raw : []);
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

  // --- VOTE ACTIONS ---
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
      error: (err) => {
        console.error('Lỗi bình chọn bài viết:', err);
      }
    });
  }

  scrollToComments() {
    const element = document.querySelector('.discussion-section');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
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
      error: (err) => {
        console.error('Lỗi bình chọn bình luận:', err);
      }
    });
  }

  // --- COMMENT ADD / DELETE ---
  addRootComment() {
    if (!this.rootCommentText.trim() || !this.post) return;

    const payload = { bodyMarkdown: this.rootCommentText.trim() };
    this.http.post<any>(`/api/posts/${this.post.id}/comments`, payload).subscribe({
      next: () => {
        this.rootCommentText = '';
        if (this.post) {
          this.post.commentCount += 1;
        }
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

    const payload = {
      bodyMarkdown: this.replyCommentText.trim(),
      parentId: parentId
    };

    this.http.post<any>(`/api/posts/${this.post.id}/comments`, payload).subscribe({
      next: () => {
        this.replyingCommentId = null;
        this.replyCommentText = '';
        if (this.post) {
          this.post.commentCount += 1;
        }
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

  // --- MODERATION ACTIONS ---
  toggleModeratePost() {
    if (!this.post) return;
    const hide = !this.post.isHidden;
    const reason = prompt(hide ? 'Nhập lý do ẩn bài viết:' : 'Nhập lý do hiện lại bài viết:');
    if (reason === null) return;

    this.http.post<any>(`/api/posts/${this.post.id}/moderate`, {
      reason: reason.trim(),
      hidden: hide
    }).subscribe({
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

    this.http.post<any>(`/api/comments/${comment.id}/moderate`, {
      reason: reason.trim(),
      hidden: hide
    }).subscribe({
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

  // --- HELPERS ---
  formatRelativeTime(dateString: string): string {
    if (!dateString) return '';
    const now = new Date();
    const date = new Date(dateString);
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Vừa xong';

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} phút trước`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;

    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} ngày trước`;

    const months = Math.floor(days / 30);
    return `${months} tháng trước`;
  }

  renderMarkdown(markdown: string): SafeHtml {
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

    return this.sanitizer.bypassSecurityTrustHtml(`<p>${escaped}</p>`);
  }

  // --- IMAGE ZOOM LIGHTBOX ---
  openImageZoom(url: string) {
    this.zoomedImageUrl = url;
    document.body.style.overflow = 'hidden';
  }

  closeImageZoom() {
    this.zoomedImageUrl = null;
    document.body.style.overflow = '';
  }

  isPostAuthorComment(comment: any): boolean {
    if (!comment?.author || !this.post?.author) return false;
    const commentAuthorId = (comment.author.id || '').toString().toLowerCase();
    const postAuthorId = (this.post.author.id || '').toString().toLowerCase();
    return commentAuthorId === postAuthorId;
  }

  onAvatarError(event: Event) {
    const img = event.target as HTMLImageElement;
    if (img) img.src = 'assets/images/default-avatar.svg';
  }
}
