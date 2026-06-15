import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ForumService } from '../../../core/services/forum.service';

@Component({
  selector: 'app-post-detail',
  standalone: true,
  imports: [RouterLink, CommonModule, FormsModule, NgTemplateOutlet],
  templateUrl: './post-detail.html',
  styleUrl: './post-detail.css'
})
export class PostDetailComponent implements OnInit {
  private forumService = inject(ForumService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private http = inject(HttpClient);

  postId: string = '';
  post: any = null;
  comments: any[] = [];
  
  loading: boolean = false;
  currentUserId: string = '';
  currentUserRoles: string[] = [];

  // Form states
  rootCommentText: string = '';
  replyCommentText: string = '';
  editingCommentText: string = '';
  
  replyingCommentId: string | null = null;
  editingCommentId: string | null = null;
  
  isBookmarked: boolean = false;

  // Lightbox state
  isLightboxOpen: boolean = false;
  lightboxImageUrl: string = '';

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.postId = params['id'] || '';
      if (this.postId) {
        this.loadCurrentUser();
      }
    });
  }

  loadCurrentUser() {
    this.http.get<any>('/api/users/me').subscribe({
      next: (res) => {
        const user = res?.data || res;
        if (user) {
          this.currentUserId = (user.id || user.Id || user.userId || user.sub || '').toString().toLowerCase();
          this.currentUserRoles = user.roles || [];
        }
        this.loadPostDetails();
      },
      error: () => {
        this.loadPostDetails();
      }
    });
  }

  loadPostDetails() {
    this.loading = true;
    this.cdr.detectChanges();

    this.forumService.getPost(this.postId).subscribe({
      next: (res) => {
        this.post = res;
        if (this.post) {
          this.isBookmarked = false;
        }
        this.loadComments();
      },
      error: (err) => {
        console.error('Lỗi tải bài viết chi tiết:', err);
        this.post = null;
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadComments() {
    this.forumService.getComments(this.postId).subscribe({
      next: (res) => {
        this.comments = res || [];
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
    if (!this.checkLogin()) return;

    this.forumService.votePost(this.post.id, voteType).subscribe({
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

  sharePost() {
    if (!this.post) return;
    const shareUrl = `${window.location.origin}/forum/post/${this.post.id}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      alert('Đã sao chép liên kết bài viết vào bộ nhớ tạm!');
    }).catch(err => {
      console.error('Không thể sao chép liên kết:', err);
    });
  }

  toggleBookmark() {
    // Vô hiệu hóa lưu bookmark local do BE chưa có API
  }

  scrollToComments() {
    const element = document.querySelector('.discussion-section');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }

  voteComment(comment: any, voteType: 'up' | 'down') {
    if (!this.checkLogin()) return;

    this.forumService.voteComment(comment.id, voteType).subscribe({
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

  // --- COMMENT ADD / EDIT / DELETE ---
  addRootComment() {
    if (!this.checkLogin()) return;
    if (!this.rootCommentText.trim()) return;

    const payload = { bodyMarkdown: this.rootCommentText.trim() };
    this.forumService.addComment(this.postId, payload).subscribe({
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
    if (!this.checkLogin()) return;
    if (!this.replyCommentText.trim()) return;

    const payload = { 
      bodyMarkdown: this.replyCommentText.trim(),
      parentId: parentId
    };

    this.forumService.addComment(this.postId, payload).subscribe({
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

  startEditComment(comment: any) {
    this.editingCommentId = comment.id;
    this.editingCommentText = comment.bodyMarkdown;
    this.cdr.detectChanges();
  }

  cancelEditComment() {
    this.editingCommentId = null;
    this.editingCommentText = '';
    this.cdr.detectChanges();
  }

  saveEditComment(commentId: string) {
    if (!this.editingCommentText.trim()) return;

    const payload = { bodyMarkdown: this.editingCommentText.trim() };
    this.forumService.updateComment(commentId, payload).subscribe({
      next: () => {
        this.editingCommentId = null;
        this.editingCommentText = '';
        this.loadComments();
      },
      error: (err) => {
        console.error('Lỗi cập nhật bình luận:', err);
        alert('Không thể lưu thay đổi.');
      }
    });
  }

  deleteComment(commentId: string) {
    if (!confirm('Bạn có chắc chắn muốn xóa bình luận này và toàn bộ bình luận con của nó không?')) return;

    this.forumService.deleteComment(commentId).subscribe({
      next: (res) => {
        alert('Đã xóa bình luận thành công.');
        this.loadPostDetails(); // Tải lại cả post để cập nhật số lượng bình luận chính xác
      },
      error: (err) => {
        console.error('Lỗi xóa bình luận:', err);
        alert('Không thể xóa bình luận.');
      }
    });
  }

  // --- ACCEPT BEST ANSWER ---
  acceptComment(commentId: string) {
    if (!this.post) return;
    
    this.forumService.acceptComment(commentId).subscribe({
      next: (res: any) => {
        // Cập nhật lại accepted comment ID trong view
        if (res) {
          this.post.acceptedCommentId = res.isAccepted ? res.commentId : null;
          this.loadComments();
        }
      },
      error: (err) => {
        console.error('Lỗi chấp nhận câu trả lời tốt nhất:', err);
        alert('Không thể chọn câu trả lời này làm tốt nhất.');
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

    this.forumService.deletePost(this.postId).subscribe({
      next: () => {
        alert('Đã xóa bài viết thành công!');
        this.router.navigate(['/forum']);
      },
      error: (err) => {
        console.error('Lỗi xóa bài viết:', err);
        alert('Không thể xóa bài viết.');
      }
    });
  }

  // --- HELPERS / AUTH CHECKS ---
  checkLogin(): boolean {
    const hasToken = typeof window !== 'undefined' && Boolean(localStorage.getItem('accessToken') || localStorage.getItem('token'));
    if (!hasToken) {
      alert('Vui lòng đăng nhập để thực hiện hành động này!');
      this.router.navigate(['/login']);
      return false;
    }
    return true;
  }

  isPostAuthor(): boolean {
    if (!this.post || !this.currentUserId) return false;
    const postAuthorId = (this.post.author.id || '').toString().toLowerCase();
    return postAuthorId === this.currentUserId;
  }

  canEditPost(): boolean {
    return this.isPostAuthor();
  }

  canDeletePost(): boolean {
    return this.isPostAuthor() || this.isModeratorOrAdmin();
  }

  canEditComment(comment: any): boolean {
    if (!comment || !this.currentUserId) return false;
    const commentAuthorId = (comment.author.id || '').toString().toLowerCase();
    return commentAuthorId === this.currentUserId;
  }

  canDeleteComment(comment: any): boolean {
    if (!comment || !this.currentUserId) return false;
    const commentAuthorId = (comment.author.id || '').toString().toLowerCase();
    return commentAuthorId === this.currentUserId || this.isModeratorOrAdmin();
  }

  isModeratorOrAdmin(): boolean {
    return this.currentUserRoles.some(role => 
      role.toLowerCase() === 'admin' || role.toLowerCase() === 'moderator'
    );
  }

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

  // Custom regex-based basic Markdown parser to support code blocks and basic styles safely
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

    return `<p>${escaped}</p>`;
  }

  openLightbox(url: string) {
    this.lightboxImageUrl = url;
    this.isLightboxOpen = true;
    this.cdr.detectChanges();
  }

  closeLightbox() {
    this.isLightboxOpen = false;
    this.lightboxImageUrl = '';
    this.cdr.detectChanges();
  }
}
