import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ForumService } from '../../core/services/forum.service';
import { HttpClient } from '@angular/common/http';
import { ReportService } from '../../core/services/report.service';
import { ReviewStatusBadgeComponent } from '../../shared/components/review-status-badge/review-status-badge';

@Component({
  selector: 'app-forum',
  standalone: true,
  imports: [RouterLink, CommonModule, FormsModule, ReviewStatusBadgeComponent],
  templateUrl: './forum.html',
  styleUrl: './forum.css'
})
export class ForumComponent implements OnInit, OnDestroy {
  private forumService = inject(ForumService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);
  private http = inject(HttpClient);
  private reportService = inject(ReportService);

  posts: any[] = [];
  tags: any[] = [];
  
  activePostMenuId: string | null = null;
  currentUserPermissions: string[] = [];
  
  // State của feed
  page: number = 1;
  pageSize: number = 15;
  totalCount: number = 0;
  totalPages: number = 0;
  searchText: string = '';
  selectedTag: string = '';
  filteredPosts: any[] = [];
  
  isReportModalOpen: boolean = false;
  reportingPost: any = null;
  reportDescription: string = '';
  
  loading: boolean = false;
  tagsLoading: boolean = false;
  zoomedImageUrl: string | null = null;
  selectedLightboxPost: any = null;
  lightboxComments: any[] = [];
  lightboxCommentText: string = '';
  imageZoomLevel = 1;
  imageTranslateX = 0;
  imageTranslateY = 0;
  isImageDragging = false;
  private imageDragStartX = 0;
  private imageDragStartY = 0;
  private imageDragBaseX = 0;
  private imageDragBaseY = 0;

  ngOnInit() {
    // Lắng nghe queryParams để hỗ trợ quay lại/đi tiếp bằng browser history
    this.route.queryParams.subscribe(params => {
      const newTag = params['tag'] || '';
      const newSearch = params['search'] || '';
      
      // Nếu thay đổi bộ lọc hoặc từ khóa tìm kiếm, reset danh sách và số trang
      if (newTag !== this.selectedTag || newSearch !== this.searchText) {
        this.selectedTag = newTag;
        this.searchText = newSearch;
        this.page = 1;
        this.posts = [];
        this.filteredPosts = [];
      }
      
      this.loadPosts();
      this.cdr.detectChanges();
    });

    this.loadTags();
    this.loadCurrentUser();
  }

  currentUserId: string = '';

  loadCurrentUser() {
    this.http.get<any>('/api/users/me').subscribe({
      next: (res) => {
        const user = res?.data || res;
        if (user) {
          this.currentUserId = (user.id || user.Id || user.userId || user.sub || '').toString().toLowerCase();
          this.currentUserPermissions = (user.permissions || []).map((p: string) => (p || '').toLowerCase());
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi lấy thông tin người dùng trong forum:', err);
      }
    });
  }

  deletePost(postId: string, event: Event) {
    event.stopPropagation();
    if (!confirm('Bạn có chắc chắn muốn xóa bài viết này không?')) return;

    this.http.delete<any>(`/api/posts/${postId}`).subscribe({
      next: () => {
        this.posts = this.posts.filter(p => p.id !== postId);
        this.filteredPosts = this.filteredPosts.filter(p => p.id !== postId);
        alert('Đã xóa bài viết thành công!');
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi xóa bài viết:', err);
        alert('Không thể xóa bài viết. Vui lòng thử lại sau.');
      }
    });
  }

  editPost(postId: string, event: Event) {
    event.stopPropagation();
    this.activePostMenuId = null;
    this.router.navigate(['/forum/edit', postId]);
  }

  toggleHidePost(post: any, event: Event) {
    event.stopPropagation();
    this.activePostMenuId = null;
    const nextHiddenState = !post.isHidden;
    const actionName = nextHiddenState ? 'ẩn' : 'hiển thị';
    if (!confirm(`Bạn có chắc chắn muốn ${actionName} bài viết này không?`)) return;

    this.http.post<any>(`/api/posts/${post.id}/moderate`, { reason: 'Moderated from community feed', hidden: nextHiddenState }).subscribe({
      next: () => {
        alert(`Đã ${actionName} bài viết thành công.`);
        post.isHidden = nextHiddenState;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(`Lỗi ${actionName} bài viết:`, err);
        alert(err?.error?.message || `Không thể ${actionName} bài viết. Vui lòng thử lại sau.`);
      }
    });
  }

  // Ownership-based approach: permission checks are removed from Web.User.
  // Admin/moderation features are handled by Web.Admin only.
  isOwner(authorId?: string): boolean {
    return !!authorId && authorId === this.currentUserId;
  }

  isAdminPost(post: any): boolean {
    return post?.author?.roles?.some((r: string) => r.toLowerCase() === 'admin' || r.toLowerCase() === 'system.full_control') || false;
  }

  onCreatePostClick() {
    const hasToken = typeof window !== 'undefined' && Boolean(localStorage.getItem('accessToken') || localStorage.getItem('token'));
    if (!hasToken) {
      alert('Vui lòng đăng nhập để đăng bài viết!');
      this.router.navigate(['/login']);
      return;
    }

    // Ownership-based logic: any logged-in user can create posts post.
    // Backend will enforce any remaining business rules.
    this.router.navigate(['/forum/create']);
  }

  togglePostMenu(postId: string, event: Event) {
    event.stopPropagation();
    this.activePostMenuId = this.activePostMenuId === postId ? null : postId;
    this.cdr.detectChanges();
  }

  @HostListener('document:click')
  onDocumentClick() {
    this.activePostMenuId = null;
    this.cdr.detectChanges();
  }

  @HostListener('document:scroll', ['$event'])
  onScroll(event: any) {
    if (this.loading || this.page >= this.totalPages) return;

    const container = document.querySelector('.dashboard-scroll-body');
    if (!container) return;

    const threshold = 250; // px từ cạnh dưới
    const position = container.scrollTop + container.clientHeight;
    const height = container.scrollHeight;

    if (height - position < threshold) {
      this.page++;
      this.loadPosts();
    }
  }

  ngOnDestroy() {
    document.body.style.overflow = '';
  }

  openReportModal(post: any, event: Event) {
    event.stopPropagation();
    if (!this.checkLoginForReport()) return;

    const authorId = (post?.author?.id || post?.authorId || post?.createdBy || '').toString().toLowerCase();
    if (authorId && authorId === this.currentUserId) {
      alert('Bạn không thể báo cáo bài viết của chính mình!');
      this.activePostMenuId = null;
      return;
    }

    this.reportingPost = post;
    this.reportDescription = '';
    this.isReportModalOpen = true;
    this.activePostMenuId = null;
    this.cdr.detectChanges();
  }

  closeReportModal() {
    this.isReportModalOpen = false;
    this.reportDescription = '';
    this.reportingPost = null;
    this.cdr.detectChanges();
  }

  submitReport() {
    const description = this.reportDescription.trim();
    if (!description) {
      alert('Vui lòng mô tả nội dung vi phạm.');
      return;
    }
    if (!this.reportingPost?.id) {
      alert('Không xác định được bài đăng cần báo cáo.');
      return;
    }

    const enrichedDescription = [
      `Bài đăng: ${this.reportingPost.title || this.reportingPost.id}`,
      description
    ].join('\n');

    this.reportService.createReport('post', this.reportingPost.id, enrichedDescription).subscribe({
      next: () => {
        alert('Cảm ơn bạn! Báo cáo bài đăng đã được gửi để xem xét.');
        this.closeReportModal();
      },
      error: (err) => {
        alert(err?.error?.message || 'Không thể gửi báo cáo. Vui lòng thử lại sau.');
      }
    });
  }

  private checkLoginForReport(): boolean {
    const hasToken = typeof window !== 'undefined' && Boolean(localStorage.getItem('accessToken') || localStorage.getItem('token'));
    if (!hasToken) {
      alert('Vui lòng đăng nhập để báo cáo nội dung vi phạm.');
      this.router.navigate(['/login']);
      return false;
    }
    return true;
  }

  changePage(p: number) {
    if (p < 1 || p > this.totalPages || p === this.page) return;
    this.page = p;
    this.posts = [];
    this.filteredPosts = [];
    this.loadPosts();
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    for (let i = 1; i <= this.totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  private shuffleArray(array: any[]): any[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  loadPosts() {
    if (this.loading) return;
    this.loading = true;
    this.cdr.detectChanges();

    this.forumService.getPosts(this.page, this.pageSize, this.searchText, this.selectedTag).subscribe({
      next: (res) => {
        const pagedData = res || { items: [], totalCount: 0, page: 1, pageSize: 15, totalPages: 0 };
        
        // Trộn ngẫu nhiên danh sách bài viết nhận được từ API để hiển thị kiểu Facebook recommendation
        const shuffledItems = this.shuffleArray(pagedData.items || []);
        
        const mappedItems = shuffledItems.map((post: any) => {
          post.isBookmarked = false;
          // Tải chi tiết bài viết bất đồng bộ để lấy nội dung & ảnh
          this.forumService.getPost(post.id).subscribe({
            next: (detail) => {
              if (detail) {
                post.bodyMarkdown = detail.bodyMarkdown;
                post.imageUrl = detail.imageUrl;
                post.myVote = detail.myVote || null;
                this.applyFilters();
                this.cdr.detectChanges();
              }
            }
          });
          return post;
        });

        if (this.page === 1) {
          this.posts = mappedItems;
        } else {
          this.posts = [...this.posts, ...mappedItems];
        }

        this.totalCount = pagedData.totalCount || 0;
        this.totalPages = pagedData.totalPages || 0;
        this.page = pagedData.page || 1;
        this.loading = false;
        this.applyFilters();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi tải bài đăng:', err);
        if (this.page === 1) {
          this.posts = [];
          this.filteredPosts = [];
        }
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  sortBy: 'newest' | 'votes' | 'featured' = 'newest';

  setSortBy(sortType: 'newest' | 'votes' | 'featured') {
    this.sortBy = sortType;
    this.applyFilters();
  }

  applyFilters() {
    let result = [...this.posts];

    // "Đáng chú ý" chỉ hiển thị bài của Admin, mới nhất lên trước — không ghim, không trộn bài thường.
    if (this.sortBy === 'featured') {
      result = result
        .filter(post => this.isAdminPost(post))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      this.filteredPosts = result;
      this.cdr.detectChanges();
      return;
    }

    if (this.sortBy === 'newest') {
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (this.sortBy === 'votes') {
      result.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
    }

    // Bài viết của Admin luôn được ghim lên đầu diễn đàn, giữ nguyên thứ tự sắp xếp đã chọn trong từng nhóm.
    const pinned = result.filter(post => this.isAdminPost(post));
    const rest = result.filter(post => !this.isAdminPost(post));
    this.filteredPosts = [...pinned, ...rest];
    this.cdr.detectChanges();
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
        this.tags = [];
        this.tagsLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onSearchInput(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input) {
      this.searchText = input.value;
      this.cdr.detectChanges();
    }
  }

  triggerSearch() {
    this.page = 1;
    this.posts = [];
    this.filteredPosts = [];
    this.updateRoute();
  }

  filterByTag(tagSlug: string) {
    if (this.selectedTag === tagSlug) {
      this.selectedTag = '';
    } else {
      this.selectedTag = tagSlug;
    }
    this.page = 1;
    this.posts = [];
    this.filteredPosts = [];
    this.updateRoute();
  }

  updateRoute() {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        tag: this.selectedTag || null,
        search: this.searchText || null
      },
      queryParamsHandling: 'merge'
    });
  }

  viewPostDetail(postId: string) {
    this.router.navigate(['/forum/post', postId]);
  }

  goToProfile(userId: string, event: Event) {
    event.stopPropagation();
    this.router.navigate(['/user', userId], {
      state: { returnUrl: '/forum' }
    });
  }

  vote(post: any, voteType: 'up' | 'down') {
    const hasToken = typeof window !== 'undefined' && Boolean(localStorage.getItem('accessToken') || localStorage.getItem('token'));
    if (!hasToken) {
      alert('Vui lòng đăng nhập để bình chọn bài viết!');
      this.router.navigate(['/login']);
      return;
    }

    this.forumService.votePost(post.id, voteType).subscribe({
      next: (res) => {
        if (res) {
          post.upvotes = res.upvotes;
          post.downvotes = res.downvotes;
          post.myVote = res.myVote;
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('Lỗi vote bài viết:', err);
        alert('Có lỗi xảy ra khi gửi bình chọn!');
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

  getExcerpt(bodyMarkdown: string): string {
    if (!bodyMarkdown) return '';
    let text = bodyMarkdown
      .replace(/#+\s+/g, '') // remove headers
      .replace(/```[\s\S]*?```/g, '') // remove code blocks
      .replace(/`([^`]+)`/g, '$1') // remove inline code
      .replace(/\*\*([^*]+)\*\*/g, '$1') // remove bold
      .replace(/\*([^*]+)\*/g, '$1') // remove italic
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1') // remove links
      .trim();
    
    if (text.length > 180) {
      return text.substring(0, 180) + '...';
    }
    return text;
  }

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

  sharePost(postId: string, event: Event) {
    event.stopPropagation();
    const shareUrl = `${window.location.origin}/forum/post/${postId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      alert('Đã sao chép liên kết bài viết vào bộ nhớ tạm!');
    }).catch(err => {
      console.error('Không thể sao chép liên kết:', err);
    });
  }

  toggleBookmark(post: any, event: Event) {
    event.stopPropagation();
    // Vô hiệu hóa lưu bookmark local do BE chưa có API
  }

  onAvatarError(event: Event) {
    const img = event.target as HTMLImageElement;
    if (img) img.src = 'assets/images/default-avatar.svg';
  }

  openImageZoom(url: string, post?: any) {
    this.zoomedImageUrl = url;
    this.selectedLightboxPost = post || null;
    this.lightboxComments = [];
    this.lightboxCommentText = '';
    this.resetImageTransform();
    document.body.style.overflow = 'hidden';

    if (post) {
      this.forumService.getComments(post.id).subscribe({
        next: (comments) => {
          const raw = comments || [];
          let arr = Array.isArray(raw) ? raw : [];
          arr = arr.filter((c: any) => !c.parentId);
          this.lightboxComments = arr;
          this.cdr.detectChanges();
        }
      });
    }
    this.cdr.detectChanges();
  }

  addLightboxComment() {
    if (!this.selectedLightboxPost || !this.lightboxCommentText.trim()) return;
    const hasToken = typeof window !== 'undefined' && Boolean(localStorage.getItem('accessToken') || localStorage.getItem('token'));
    if (!hasToken) {
      alert('Vui lòng đăng nhập để bình luận!');
      this.router.navigate(['/login']);
      return;
    }

    const payload = { bodyMarkdown: this.lightboxCommentText.trim() };
    this.forumService.addComment(this.selectedLightboxPost.id, payload).subscribe({
      next: (res) => {
        this.lightboxCommentText = '';
        this.forumService.getComments(this.selectedLightboxPost.id).subscribe({
          next: (comments) => {
            const raw = comments || [];
            let arr = Array.isArray(raw) ? raw : [];
            this.selectedLightboxPost.commentCount = arr.length;
            arr = arr.filter((c: any) => !c.parentId);
            this.lightboxComments = arr;
            this.cdr.detectChanges();
          }
        });
      },
      error: (err) => {
        console.error('Lỗi gửi bình luận trong lightbox:', err);
        alert('Có lỗi xảy ra khi gửi bình luận.');
      }
    });
  }

  closeImageZoom() {
    this.zoomedImageUrl = null;
    this.selectedLightboxPost = null;
    this.resetImageTransform();
    document.body.style.overflow = '';
    this.cdr.detectChanges();
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

  @HostListener('document:mousemove', ['$event'])
  onImageDragMove(event: MouseEvent) { this.moveImageDrag(event); }

  @HostListener('document:touchmove', ['$event'])
  onImageTouchMove(event: TouchEvent) { this.moveImageDrag(event); }

  @HostListener('document:mouseup')
  @HostListener('document:touchend')
  stopImageDrag() { this.isImageDragging = false; }

  private moveImageDrag(event: MouseEvent | TouchEvent) {
    if (!this.isImageDragging || this.imageZoomLevel <= 1) return;
    event.preventDefault();
    const point = this.getDragPoint(event);
    this.imageTranslateX = this.imageDragBaseX + point.x - this.imageDragStartX;
    this.imageTranslateY = this.imageDragBaseY + point.y - this.imageDragStartY;
  }

  private getDragPoint(event: MouseEvent | TouchEvent): { x: number; y: number } {
    if ('touches' in event && event.touches.length > 0) return { x: event.touches[0].clientX, y: event.touches[0].clientY };
    const mouseEvent = event as MouseEvent;
    return { x: mouseEvent.clientX, y: mouseEvent.clientY };
  }

  @HostListener('document:keydown.escape')
  onEscapeKey() {
    if (this.zoomedImageUrl) {
      this.closeImageZoom();
    }
  }
}

