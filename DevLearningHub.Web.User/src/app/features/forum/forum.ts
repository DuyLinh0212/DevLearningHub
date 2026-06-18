import { Component, inject, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ForumService } from '../../core/services/forum.service';

@Component({
  selector: 'app-forum',
  standalone: true,
  imports: [RouterLink, CommonModule, FormsModule],
  templateUrl: './forum.html',
  styleUrl: './forum.css'
})
export class ForumComponent implements OnInit {
  private forumService = inject(ForumService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);

  posts: any[] = [];
  tags: any[] = [];

  activePostMenuId: string | null = null;

  pageSize: number = 15;
  searchText: string = '';
  selectedTag: string = '';
  filteredPosts: any[] = [];
  nextCursor: string | null = null;
  nextCursorId: string | null = null;
  hasMorePosts: boolean = false;

  loading: boolean = false;
  tagsLoading: boolean = false;

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.selectedTag = params['tag'] || '';
      this.searchText = params['search'] || '';
      this.loadPosts(true);
      this.cdr.detectChanges();
    });

    this.loadTags();
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

  loadPosts(reset: boolean = false) {
    if (this.loading) return;
    this.loading = true;

    if (reset) {
      this.posts = [];
      this.filteredPosts = [];
      this.nextCursor = null;
      this.nextCursorId = null;
      this.hasMorePosts = false;
    }

    this.cdr.detectChanges();

    this.forumService.getPosts(
      this.pageSize,
      this.searchText,
      this.selectedTag,
      undefined,
      reset ? null : this.nextCursor,
      reset ? null : this.nextCursorId
    ).subscribe({
      next: (res) => {
        const cursorData = res || {
          items: [],
          pageSize: this.pageSize,
          nextCursor: null,
          nextCursorId: null,
          hasMore: false
        };

        const incomingPosts = (cursorData.items || []).map((post: any) => {
          post.isBookmarked = false;
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

        this.posts = reset ? incomingPosts : [...this.posts, ...incomingPosts];
        this.nextCursor = cursorData.nextCursor || null;
        this.nextCursorId = cursorData.nextCursorId || null;
        this.hasMorePosts = !!cursorData.hasMore;
        this.loading = false;
        this.applyFilters();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi tải bài đăng:', err);
        this.posts = [];
        this.filteredPosts = [];
        this.nextCursor = null;
        this.nextCursorId = null;
        this.hasMorePosts = false;
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadMorePosts() {
    if (!this.hasMorePosts || this.loading) return;
    this.loadPosts(false);
  }

  applyFilters() {
    this.filteredPosts = [...this.posts];
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
    this.updateRoute();
  }

  filterByTag(tagSlug: string) {
    this.selectedTag = tagSlug;
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
      .replace(/#+\s+/g, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
      .trim();

    if (text.length > 180) {
      return text.substring(0, 180) + '...';
    }
    return text;
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
  }

  onAvatarError(event: Event) {
    const img = event.target as HTMLImageElement;
    if (img) img.src = 'assets/images/default-avatar.svg';
  }
}
