import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { ForumService } from '../../../core/services/forum.service';
import { CommentRealtimeService, CommentDeletedEvent } from '../../../core/services/comment-realtime.service';
import { StaffUserService } from '../../../core/services/staff-user.service';

@Component({
  selector: 'app-post-detail',
  standalone: true,
  imports: [RouterLink, CommonModule, FormsModule, NgTemplateOutlet],
  templateUrl: './post-detail.html',
  styleUrl: './post-detail.css'
})
export class PostDetailComponent implements OnInit, OnDestroy {
  private forumService = inject(ForumService);
  private staffUserService = inject(StaffUserService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private http = inject(HttpClient);
  private realtime = inject(CommentRealtimeService);

  private subscriptions = new Subscription();

  postId: string = '';
  post: any = null;
  comments: any[] = [];
  
  loading: boolean = false;
  currentUserId: string = '';
  currentUserRoles: string[] = [];
  currentUserPermissions: string[] = [];

  // Form states
  rootCommentText: string = '';
  replyCommentText: string = '';
  editingCommentText: string = '';
  
  replyingCommentId: string | null = null;
  editingCommentId: string | null = null;
  
  isBookmarked: boolean = false;
  zoomedImageUrl: string | null = null;
  imageZoom: number = 100;
  imagePanX: number = 0;
  imagePanY: number = 0;
  isImageDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private panStartX: number = 0;
  private panStartY: number = 0;

  ngOnInit() {
    // Subscribe once to realtime comment events; handlers filter by postId.
    this.subscriptions.add(
      this.realtime.commentCreated$.subscribe(comment => this.onCommentCreated(comment))
    );
    this.subscriptions.add(
      this.realtime.commentUpdated$.subscribe(comment => this.onCommentUpdated(comment))
    );
    this.subscriptions.add(
      this.realtime.commentDeleted$.subscribe(payload => this.onCommentDeleted(payload))
    );

    this.subscriptions.add(
      this.route.params.subscribe(params => {
        this.postId = params['id'] || '';
        if (this.postId) {
          this.loadCurrentUser();
          // Join the SignalR group so this post receives live comment updates.
          this.realtime.joinPost(this.postId);
        }
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
    this.realtime.leaveCurrentPost();
  }

  // --- REALTIME COMMENT HANDLERS ---
  // These keep the nested comment tree in sync with what other users do,
  // without a full reload. All handlers are idempotent so the acting user
  // (who also receives their own broadcast) never gets duplicates.
  private onCommentCreated(comment: any) {
    if (!comment || comment.postId !== this.postId) return;

    const existing = this.findCommentById(this.comments, comment.id);
    if (existing) {
      // Already in the tree (e.g. our own optimistic reload): just refresh fields.
      this.applyCommentFields(existing, comment);
    } else {
      const node = { ...comment, replies: comment.replies || [] };
      if (comment.parentId) {
        const parent = this.findCommentById(this.comments, comment.parentId);
        if (parent) {
          parent.replies = parent.replies || [];
          parent.replies.push(node);
        } else {
          // Parent not visible locally; drop it at root rather than lose it.
          this.comments.push(node);
        }
      } else {
        this.comments.push(node);
      }
    }

    this.refreshCommentCount();
    this.cdr.detectChanges();
  }

  private onCommentUpdated(comment: any) {
    if (!comment || comment.postId !== this.postId) return;

    const existing = this.findCommentById(this.comments, comment.id);
    if (existing) {
      this.applyCommentFields(existing, comment);
      this.cdr.detectChanges();
    }
  }

  private onCommentDeleted(payload: CommentDeletedEvent) {
    if (!payload || payload.postId !== this.postId) return;

    const ids = new Set(payload.deletedIds || []);
    this.comments = this.removeCommentsByIds(this.comments, ids);

    // A deleted comment can no longer be the accepted answer.
    if (this.post && this.post.acceptedCommentId && ids.has(this.post.acceptedCommentId)) {
      this.post.acceptedCommentId = null;
    }

    this.refreshCommentCount();
    this.cdr.detectChanges();
  }

  // Copy server-owned fields onto an existing node, preserving the local
  // reply list and the client-only myVote flag.
  private applyCommentFields(target: any, source: any) {
    target.bodyMarkdown = source.bodyMarkdown;
    target.upvotes = source.upvotes;
    target.downvotes = source.downvotes;
    target.isAccepted = source.isAccepted;
    target.isHidden = source.isHidden;
    target.updatedAt = source.updatedAt;
    target.author = source.author ?? target.author;
  }

  private findCommentById(nodes: any[], id: string): any | null {
    for (const node of nodes || []) {
      if (node.id === id) return node;
      const found = this.findCommentById(node.replies || [], id);
      if (found) return found;
    }
    return null;
  }

  private removeCommentsByIds(nodes: any[], ids: Set<string>): any[] {
    return (nodes || [])
      .filter(node => !ids.has(node.id))
      .map(node => ({
        ...node,
        replies: this.removeCommentsByIds(node.replies || [], ids)
      }));
  }

  private countComments(nodes: any[]): number {
    return (nodes || []).reduce(
      (total, node) => total + 1 + this.countComments(node.replies || []),
      0
    );
  }

  private refreshCommentCount() {
    if (this.post) {
      this.post.commentCount = this.countComments(this.comments);
    }
  }

  loadCurrentUser() {
    this.http.get<any>('/api/users/me').subscribe({
      next: (res) => {
        const user = res?.data || res;
        if (user) {
          this.currentUserId = (user.id || user.Id || user.userId || user.sub || '').toString().toLowerCase();
          this.currentUserRoles = user.roles || [];
          this.currentUserPermissions = (user.permissions || []).map((p: string) => (p || '').toLowerCase());
        }
        this.staffUserService.ensureLoaded().subscribe({
          next: () => this.loadPostDetails(),
          error: () => this.loadPostDetails()
        });
      },
      error: () => {
        this.staffUserService.ensureLoaded().subscribe({
          next: () => this.loadPostDetails(),
          error: () => this.loadPostDetails()
        });
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
        const raw = res || [];
        const arr = Array.isArray(raw) ? raw : [];
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

  toggleModeratePost() {
    if (!this.post) return;
    const hide = !this.post.isHidden;
    const reason = prompt(hide ? 'Nhập lý do ẩn bài viết:' : 'Nhập lý do hiện lại bài viết:');
    if (reason === null) return;

    this.forumService.moderatePost(this.post.id, hide, reason.trim()).subscribe({
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

  goToProfile(userId: string) {
    if (userId) { 
      const postId = this.route.snapshot.paramMap.get('id');
      this.router.navigate(['/user', userId], {
        state: { returnUrl: `/forum/post/${postId}` }
      }); 
    }
  }

  // True when the logged-in user holds the given permission (or full-control wildcard).
  hasPermission(permission: string): boolean {
    const target = (permission || '').toLowerCase();
    return this.currentUserPermissions.includes(target)
      || this.currentUserPermissions.includes('system.full_control');
  }

  isPostAuthor(): boolean {
    if (!this.post || !this.currentUserId) return false;
    const postAuthorId = (this.post.author.id || '').toString().toLowerCase();
    return postAuthorId === this.currentUserId;
  }

  canEditPost(): boolean {
    // Author edits own; anyone with post:edit_any can edit any post.
    return this.isPostAuthor() || this.hasPermission('post:edit_any');
  }

  canDeletePost(): boolean {
    // Author deletes own; anyone with post:delete_any can delete any post.
    return this.isPostAuthor() || this.hasPermission('post:delete_any');
  }

  canHidePost(): boolean {
    // Anyone with post:hide can hide/unhide any post.
    return this.hasPermission('post:hide');
  }

  canEditComment(comment: any): boolean {
    // Comment editing stays author-only (the API allows only the author to edit).
    if (!comment || !this.currentUserId) return false;
    const commentAuthorId = (comment.author.id || '').toString().toLowerCase();
    return commentAuthorId === this.currentUserId;
  }

  canDeleteComment(comment: any): boolean {
    if (!comment || !this.currentUserId) return false;
    const commentAuthorId = (comment.author.id || '').toString().toLowerCase();
    // Author deletes own; anyone with comment:delete can delete any comment.
    return commentAuthorId === this.currentUserId || this.hasPermission('comment:delete');
  }

  // Moderators/Admins can hide or unhide any comment (requires comment:hide permission).
  canModerateComment(): boolean {
    return this.hasPermission('comment:hide');
  }

  toggleModerateComment(comment: any) {
    const hide = !comment.isHidden;
    const reason = prompt(hide ? 'Nhập lý do ẩn bình luận:' : 'Nhập lý do hiện lại bình luận:');
    if (reason === null) return;

    this.forumService.moderateComment(comment.id, hide, reason.trim()).subscribe({
      next: () => {
        comment.isHidden = hide;
        this.loadComments();
      },
      error: (err) => {
        console.error('Lỗi kiểm duyệt bình luận:', err);
        alert('Không thể hoàn tất hành động kiểm duyệt.');
      }
    });
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

  // --- IMAGE ZOOM LIGHTBOX ---
  openImageZoom(url: string) {
    this.zoomedImageUrl = url;
    this.resetImageZoom();
    document.body.style.overflow = 'hidden';
  }

  closeImageZoom() {
    this.zoomedImageUrl = null;
    this.isImageDragging = false;
    document.body.style.overflow = '';
  }

  setImageZoom(value: number | string) {
    const nextZoom = typeof value === 'string' ? Number(value) : value;
    if (Number.isNaN(nextZoom)) return;
    this.imageZoom = Math.min(250, Math.max(50, nextZoom));

    if (this.imageZoom <= 100) {
      this.imagePanX = 0;
      this.imagePanY = 0;
    }
  }

  zoomImageIn() {
    this.setImageZoom(this.imageZoom + 25);
  }

  zoomImageOut() {
    this.setImageZoom(this.imageZoom - 25);
  }

  resetImageZoom() {
    this.imageZoom = 100;
    this.imagePanX = 0;
    this.imagePanY = 0;
  }

  startImageDrag(event: MouseEvent) {
    if (this.imageZoom <= 100) return;
    event.preventDefault();
    this.isImageDragging = true;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.panStartX = this.imagePanX;
    this.panStartY = this.imagePanY;
  }

  @HostListener('document:mousemove', ['$event'])
  onImageDrag(event: MouseEvent) {
    if (!this.isImageDragging) return;
    this.imagePanX = this.panStartX + event.clientX - this.dragStartX;
    this.imagePanY = this.panStartY + event.clientY - this.dragStartY;
  }

  @HostListener('document:mouseup')
  stopImageDrag() {
    this.isImageDragging = false;
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent) {
    if (!this.zoomedImageUrl) return;

    if (event.key === 'Escape') {
      this.closeImageZoom();
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      this.zoomImageIn();
    } else if (event.key === '-') {
      event.preventDefault();
      this.zoomImageOut();
    } else if (event.key === '0') {
      event.preventDefault();
      this.resetImageZoom();
    }
  }

  isPostAuthorComment(comment: any): boolean {
    if (!comment?.author || !this.post?.author) return false;
    const commentAuthorId = (comment.author.id || '').toString().toLowerCase();
    const postAuthorId = (this.post.author.id || '').toString().toLowerCase();
    return commentAuthorId === postAuthorId;
  }

  /** Fallback khi avatar load lỗi (null URL, 404, v.v.) */
  onAvatarError(event: Event) {
    const img = event.target as HTMLImageElement;
    if (img && img.src !== window.location.origin + '/assets/images/default-avatar.svg') {
      img.src = 'assets/images/default-avatar.svg';
    }
  }

}
