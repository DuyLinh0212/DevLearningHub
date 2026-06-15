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
  
  // State của feed
  page: number = 1;
  pageSize: number = 15;
  totalCount: number = 0;
  totalPages: number = 0;
  searchText: string = '';
  selectedTag: string = '';
  filteredPosts: any[] = [];
  
  loading: boolean = false;
  tagsLoading: boolean = false;

  ngOnInit() {
    // Lắng nghe queryParams để hỗ trợ quay lại/đi tiếp bằng browser history
    this.route.queryParams.subscribe(params => {
      this.page = params['page'] ? parseInt(params['page'], 10) : 1;
      this.selectedTag = params['tag'] || '';
      this.searchText = params['search'] || '';
      this.loadPosts();
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

  loadPosts() {
    if (this.loading) return;
    this.loading = true;
    this.cdr.detectChanges();

    this.forumService.getPosts(this.page, this.pageSize, this.searchText, this.selectedTag).subscribe({
      next: (res) => {
        const pagedData = res || { items: [], totalCount: 0, page: 1, pageSize: 15, totalPages: 0 };
        const bookmarkedIds: string[] = [];
        this.posts = (pagedData.items || []).map((post: any) => {
          post.isBookmarked = false;
          // Tải chi tiết bài viết bất đồng bộ để lấy nội dung & ảnh
          this.forumService.getPost(post.id).subscribe({
            next: (detail) => {
              if (detail) {
                post.bodyMarkdown = detail.bodyMarkdown;
                post.imageUrl = detail.imageUrl;
                // Lấy trạng thái vote của user hiện tại để giữ màu tim
                post.myVote = detail.myVote || null;
                this.applyFilters();
                this.cdr.detectChanges();
              }
            }
          });
          return post;
        });
        this.totalCount = pagedData.totalCount || 0;
        this.totalPages = pagedData.totalPages || 0;
        this.page = pagedData.page || 1;
        this.loading = false;
        this.applyFilters();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi tải bài đăng:', err);
        this.posts = [];
        this.filteredPosts = [];
        this.totalCount = 0;
        this.totalPages = 0;
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
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
    this.page = 1;
    this.updateRoute();
  }

  filterByTag(tagSlug: string) {
    this.selectedTag = tagSlug;
    this.page = 1;
    this.updateRoute();
  }

  changePage(newPage: number) {
    if (newPage < 1 || newPage > this.totalPages) return;
    this.page = newPage;
    this.updateRoute();
  }

  updateRoute() {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        page: this.page,
        tag: this.selectedTag || null,
        search: this.searchText || null
      },
      queryParamsHandling: 'merge'
    });
  }

  viewPostDetail(postId: string) {
    this.router.navigate(['/forum/post', postId]);
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

  getPageNumbers(): number[] {
    const numbers: number[] = [];
    const maxVisiblePages = 5;
    let start = Math.max(1, this.page - 2);
    let end = Math.min(this.totalPages, start + maxVisiblePages - 1);

    if (end - start + 1 < maxVisiblePages) {
      start = Math.max(1, end - maxVisiblePages + 1);
    }

    for (let i = start; i <= end; i++) {
      numbers.push(i);
    }
    return numbers;
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
}
