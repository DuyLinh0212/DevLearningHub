import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
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

  // Form states
  rootCommentText: string = '';
  replyCommentText: string = '';
  editingCommentText: string = '';
  
  replyingCommentId: string | null = null;
  editingCommentId: string | null = null;
  
  isBookmarked: boolean = false;
  zoomedImageUrl: string | null = null;

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
        console.error('Lá»—i táº£i bÃ i viáº¿t chi tiáº¿t:', err);
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
        console.error('Lá»—i táº£i bÃ¬nh luáº­n:', err);
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
        console.error('Lá»—i bÃ¬nh chá»n bÃ i viáº¿t:', err);
      }
    });
  }

  sharePost() {
    if (!this.post) return;
    const shareUrl = `${window.location.origin}/forum/post/${this.post.id}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      alert('ÄÃ£ sao chÃ©p liÃªn káº¿t bÃ i viáº¿t vÃ o bá»™ nhá»› táº¡m!');
    }).catch(err => {
      console.error('KhÃ´ng thá»ƒ sao chÃ©p liÃªn káº¿t:', err);
    });
  }

  toggleBookmark() {
    // VÃ´ hiá»‡u hÃ³a lÆ°u bookmark local do BE chÆ°a cÃ³ API
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
        console.error('Lá»—i bÃ¬nh chá»n bÃ¬nh luáº­n:', err);
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
        console.error('Lá»—i gá»­i bÃ¬nh luáº­n:', err);
        alert('CÃ³ lá»—i xáº£y ra khi gá»­i bÃ¬nh luáº­n.');
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
        console.error('Lá»—i gá»­i pháº£n há»“i:', err);
        alert('CÃ³ lá»—i xáº£y ra khi gá»­i cÃ¢u tráº£ lá»i.');
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
        console.error('Lá»—i cáº­p nháº­t bÃ¬nh luáº­n:', err);
        alert('KhÃ´ng thá»ƒ lÆ°u thay Ä‘á»•i.');
      }
    });
  }

  deleteComment(commentId: string) {
    if (!confirm('Báº¡n cÃ³ cháº¯c cháº¯n muá»‘n xÃ³a bÃ¬nh luáº­n nÃ y vÃ  toÃ n bá»™ bÃ¬nh luáº­n con cá»§a nÃ³ khÃ´ng?')) return;

    this.forumService.deleteComment(commentId).subscribe({
      next: (res) => {
        alert('ÄÃ£ xÃ³a bÃ¬nh luáº­n thÃ nh cÃ´ng.');
        this.loadPostDetails(); // Táº£i láº¡i cáº£ post Ä‘á»ƒ cáº­p nháº­t sá»‘ lÆ°á»£ng bÃ¬nh luáº­n chÃ­nh xÃ¡c
      },
      error: (err) => {
        console.error('Lá»—i xÃ³a bÃ¬nh luáº­n:', err);
        alert('KhÃ´ng thá»ƒ xÃ³a bÃ¬nh luáº­n.');
      }
    });
  }

  // --- ACCEPT BEST ANSWER ---
  acceptComment(commentId: string) {
    if (!this.post) return;
    
    this.forumService.acceptComment(commentId).subscribe({
      next: (res: any) => {
        // Cáº­p nháº­t láº¡i accepted comment ID trong view
        if (res) {
          this.post.acceptedCommentId = res.isAccepted ? res.commentId : null;
          this.loadComments();
        }
      },
      error: (err) => {
        console.error('Lá»—i cháº¥p nháº­n cÃ¢u tráº£ lá»i tá»‘t nháº¥t:', err);
        alert('KhÃ´ng thá»ƒ chá»n cÃ¢u tráº£ lá»i nÃ y lÃ m tá»‘t nháº¥t.');
      }
    });
  }

  deletePost() {
    if (!confirm('Báº¡n cÃ³ cháº¯c cháº¯n muá»‘n xÃ³a hoÃ n toÃ n bÃ i viáº¿t nÃ y? HÃ nh Ä‘á»™ng nÃ y khÃ´ng thá»ƒ hoÃ n tÃ¡c.')) return;

    this.forumService.deletePost(this.postId).subscribe({
      next: () => {
        alert('ÄÃ£ xÃ³a bÃ i viáº¿t thÃ nh cÃ´ng!');
        this.router.navigate(['/forum']);
      },
      error: (err) => {
        console.error('Lá»—i xÃ³a bÃ i viáº¿t:', err);
        alert('KhÃ´ng thá»ƒ xÃ³a bÃ i viáº¿t.');
      }
    });
  }

  // --- HELPERS / AUTH CHECKS ---
  checkLogin(): boolean {
    const hasToken = typeof window !== 'undefined' && Boolean(localStorage.getItem('accessToken') || localStorage.getItem('token'));
    if (!hasToken) {
      alert('Vui lÃ²ng Ä‘Äƒng nháº­p Ä‘á»ƒ thá»±c hiá»‡n hÃ nh Ä‘á»™ng nÃ y!');
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

  isPostAuthor(): boolean {
    if (!this.post || !this.currentUserId) return false;
    const postAuthorId = (this.post.author.id || '').toString().toLowerCase();
    return postAuthorId === this.currentUserId;
  }

  canEditPost(): boolean {
    return this.isPostAuthor();
  }

  canDeletePost(): boolean {
    return this.isPostAuthor();
  }

  canEditComment(comment: any): boolean {
    if (!comment || !this.currentUserId) return false;
    const commentAuthorId = (comment.author.id || '').toString().toLowerCase();
    return commentAuthorId === this.currentUserId;
  }

  canDeleteComment(comment: any): boolean {
    if (!comment || !this.currentUserId) return false;
    const commentAuthorId = (comment.author.id || '').toString().toLowerCase();
    return commentAuthorId === this.currentUserId;
  }

  formatRelativeTime(dateString: string): string {
    if (!dateString) return '';
    const now = new Date();
    const date = new Date(dateString);
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Vá»«a xong';
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} phÃºt trÆ°á»›c`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giá» trÆ°á»›c`;

    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} ngÃ y trÆ°á»›c`;

    const months = Math.floor(days / 30);
    return `${months} thÃ¡ng trÆ°á»›c`;
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

  /** Fallback khi avatar load lá»—i (null URL, 404, v.v.) */
  onAvatarError(event: Event) {
    const img = event.target as HTMLImageElement;
    if (img && img.src !== window.location.origin + '/assets/images/default-avatar.svg') {
      img.src = 'assets/images/default-avatar.svg';
    }
  }

}

