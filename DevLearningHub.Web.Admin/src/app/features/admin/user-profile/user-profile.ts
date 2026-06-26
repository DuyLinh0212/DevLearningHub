import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar';
import { MobileMenuService } from '../../../core/services/mobile-menu.service';

@Component({
  selector: 'app-admin-user-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './user-profile.html',
  styleUrl: './user-profile.css'
})
export class AdminUserProfileComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private sanitizer = inject(DomSanitizer);
  public mobileMenu = inject(MobileMenuService);

  isLoading = true;
  userId = '';
  user: any = null;
  stats: any = null;
  posts: any[] = [];
  notFound = false;
  backLabel = 'Quản lý thành viên';
  zoomedImageUrl: string | null = null;
  imageZoomLevel = 1;
  imageTranslateX = 0;
  imageTranslateY = 0;
  isImageDragging = false;
  private imageDragStartX = 0;
  private imageDragStartY = 0;
  private imageDragBaseX = 0;
  private imageDragBaseY = 0;
  private readonly onDocumentMouseMove = (event: MouseEvent) => this.moveImageDrag(event);
  private readonly onDocumentMouseUp = () => this.stopImageDrag();
  private readonly onDocumentTouchMove = (event: TouchEvent) => this.moveImageDrag(event);
  private readonly onDocumentTouchEnd = () => this.stopImageDrag();

  ngOnInit() {
    this.userId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.userId) {
      this.notFound = true;
      this.isLoading = false;
      this.cdr.detectChanges();
      return;
    }
    this.updateBackLabel();
    this.loadProfile(this.userId);
  }

  loadProfile(id: string) {
    this.isLoading = true;
    forkJoin({
      user: this.http.get<any>(`/api/admin/users/${id}`).pipe(catchError(() => of(null))),
      stats: this.http.get<any>(`/api/users/${id}/stats`).pipe(catchError(() => of(null))),
      posts: this.http.get<any>(`/api/posts?authorId=${id}&pageSize=20`).pipe(catchError(() => of(null)))
    }).subscribe({
      next: (res) => {
        const u = res.user?.data || res.user;
        const s = res.stats?.data || res.stats;
        
        if (!u && !s) {
          this.notFound = true;
          this.isLoading = false;
          this.cdr.detectChanges();
          return;
        }

        const postData = res.posts?.data || res.posts;
        const items = postData?.items || (Array.isArray(postData) ? postData : []);

        if (u) {
          this.user = {
            id: u.id,
            fullName: u.fullName || u.username,
            username: u.username,
            avatarUrl: u.avatarUrl,
            bio: 'Thành viên Dev Learning Hub',
            xpPoints: u.xpPoints ?? s?.totalXP ?? 0,
            roles: u.roles || []
          };
        } else {
          this.user = {
            id: id,
            fullName: items.length > 0 ? items[0].author?.fullName : null,
            username: items.length > 0 ? items[0].author?.username : null,
            avatarUrl: items.length > 0 ? items[0].author?.avatarUrl : null,
            bio: 'Thành viên Dev Learning Hub',
            xpPoints: s?.totalXP ?? 0,
            roles: []
          };
        }

        this.stats = {
          totalQuizTaken: s?.totalQuizTaken ?? 0,
          totalXP: s?.totalXP ?? 0,
          avgScore: s?.avgScore ?? 0,
          rank: s?.rank ?? 0,
          totalUpvotes: s?.totalUpvotes ?? 0,
          totalComments: s?.totalComments ?? 0,
          totalProblemsSolved: s?.totalProblemsSolved ?? 0,
          totalProblemsAttempted: s?.totalProblemsAttempted ?? 0,
          totalSubmissions: s?.totalSubmissions ?? 0,
          languageStats: s?.languageStats || []
        };

        this.posts = items;

        // Load post details for bodyMarkdown & imageUrl
        this.posts.forEach(post => {
          this.http.get<any>(`/api/posts/${post.id}`).pipe(catchError(() => of(null))).subscribe(detail => {
            if (detail) {
              const d = detail?.data || detail;
              post.bodyMarkdown = d.bodyMarkdown;
              post.imageUrl = d.imageUrl;
              post.isHidden = d.isHidden;
              if (!post.upvotes) post.upvotes = d.upvotes || 0;
              if (!post.commentCount) post.commentCount = d.commentCount || 0;
              if (!post.viewCount) post.viewCount = d.viewCount || 0;
              this.cdr.detectChanges();
            }
          });
        });

        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.notFound = true;
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  goToPost(postId: string) {
    this.router.navigate(['/admin/posts', postId], { queryParams: { returnUrl: this.router.url } });
  }

  goBack() {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    this.router.navigateByUrl(returnUrl || '/admin/users');
  }

  openImageZoom(url: string) {
    this.zoomedImageUrl = url;
    this.resetImageTransform();
    document.body.style.overflow = 'hidden';
    document.addEventListener('mousemove', this.onDocumentMouseMove);
    document.addEventListener('mouseup', this.onDocumentMouseUp);
    document.addEventListener('touchmove', this.onDocumentTouchMove, { passive: false });
    document.addEventListener('touchend', this.onDocumentTouchEnd);
  }

  closeImageZoom() {
    this.zoomedImageUrl = null;
    this.resetImageTransform();
    document.body.style.overflow = '';
    document.removeEventListener('mousemove', this.onDocumentMouseMove);
    document.removeEventListener('mouseup', this.onDocumentMouseUp);
    document.removeEventListener('touchmove', this.onDocumentTouchMove as EventListener);
    document.removeEventListener('touchend', this.onDocumentTouchEnd);
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
    const mouseEvent = event as MouseEvent;
    return { x: mouseEvent.clientX, y: mouseEvent.clientY };
  }

  private updateBackLabel() {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '';
    this.backLabel = returnUrl.startsWith('/admin/posts/') ? 'Chi tiết bài viết' : returnUrl.startsWith('/admin/posts') ? 'Quản lý bài viết' : 'Quản lý thành viên';
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
    let escaped = markdown
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const codeBlocks: string[] = [];
    escaped = escaped.replace(/```([a-zA-Z0-9+#-]+)?\s*([\s\S]*?)\s*```/g, (match, lang, code) => {
      const index = codeBlocks.length;
      const badge = lang ? `<span class="code-badge">${lang.toUpperCase()}</span>` : '';
      codeBlocks.push(`<div class="code-block-wrapper">${badge}<pre class="markdown-code-block"><code>${code.trim()}</code></pre></div>`);
      return `___CODEBLOCK_${index}___`;
    });
    escaped = escaped.replace(/`([^`]+)`/g, '<code class="markdown-inline-code">$1</code>');
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    escaped = escaped.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');
    codeBlocks.forEach((html, index) => {
      escaped = escaped.replace(`___CODEBLOCK_${index}___`, html);
    });
    return this.sanitizer.bypassSecurityTrustHtml(`<p>${escaped}</p>`);
  }

  onAvatarError(e: Event) {
    const img = e.target as HTMLImageElement;
    if (img) img.src = 'assets/images/default-avatar.svg';
  }

  ngOnDestroy() {
    document.body.style.overflow = '';
    document.removeEventListener('mousemove', this.onDocumentMouseMove);
    document.removeEventListener('mouseup', this.onDocumentMouseUp);
    document.removeEventListener('touchmove', this.onDocumentTouchMove as EventListener);
    document.removeEventListener('touchend', this.onDocumentTouchEnd);
  }
}


