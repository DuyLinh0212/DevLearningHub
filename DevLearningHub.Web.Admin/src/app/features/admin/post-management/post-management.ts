import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar';

@Component({
  selector: 'app-post-management',
  standalone: true,
  imports: [CommonModule, SidebarComponent, FormsModule],
  templateUrl: './post-management.html',
  styleUrl: './post-management.css'
})
export class PostManagementComponent implements OnInit {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);

  // Data
  posts: any[] = [];
  filteredPosts: any[] = [];
  pagedPosts: any[] = [];
  isLoading = true;

  // Filters
  searchText = '';
  filterStatus = 'all';
  filterTag = 'all';
  filterDate = 'all';
  sortBy = 'newest';
  showHidden = false;
  allTags: any[] = [];

  // Pagination
  currentPage = 1;
  pageSize = 15;
  totalPages = 1;
  pageNumbers: number[] = [];

  // Moderate modal
  isModerateModalOpen = false;
  moderatingPost: any = null;
  moderateReason = '';

  // Post Detail Modal & Comments
  isDetailModalOpen = false;
  selectedPostDetail: any = null;
  postComments: any[] = [];
  newCommentText = '';

  ngOnInit() {
    this.loadAllPosts();
    this.loadAllTags();
  }

  loadAllTags() {
    this.http.get<any>('/api/tags').subscribe({
      next: (res) => {
        const data = res?.data || res || [];
        this.allTags = Array.isArray(data) ? data : [];
      },
      error: (err) => {
        console.error('Lỗi tải tags:', err);
      }
    });
  }

  loadAllPosts() {
    this.isLoading = true;
    // Load all posts (including hidden ones for admin by using a high page size)
    this.http.get<any>('/api/posts?pageSize=100&page=1').subscribe({
      next: (res) => {
        const data = res?.data?.items || res?.data || [];
        this.posts = Array.isArray(data) ? data : [];
        this.applyFilters();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi tải bài viết:', err);
        this.isLoading = false;
        this.posts = [];
        this.filteredPosts = [];
        this.cdr.detectChanges();
      }
    });
  }

  onSearchChange() {
    this.currentPage = 1;
    this.applyFilters();
  }

  toggleShowHidden() {
    this.showHidden = !this.showHidden;
    this.applyFilters();
  }

  applyFilters() {
    let result = [...this.posts];

    // Search filter (matches title, author, or tag name)
    const q = this.searchText.trim().toLowerCase();
    if (q) {
      result = result.filter(p =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.author?.username || '').toLowerCase().includes(q) ||
        (p.author?.fullName || '').toLowerCase().includes(q) ||
        (p.tags || []).some((t: any) => (t.name || '').toLowerCase().includes(q))
      );
    }

    // Tag dropdown filter
    if (this.filterTag !== 'all') {
      result = result.filter(p =>
        (p.tags || []).some((t: any) => t.id === this.filterTag)
      );
    }

    // Date range filter
    if (this.filterDate !== 'all') {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const oneWeekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
      const oneMonthAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;

      result = result.filter(p => {
        if (!p.createdAt) return false;
        const postTime = new Date(p.createdAt).getTime();
        if (this.filterDate === 'today') {
          return postTime >= todayStart;
        } else if (this.filterDate === 'week') {
          return postTime >= oneWeekAgo;
        } else if (this.filterDate === 'month') {
          return postTime >= oneMonthAgo;
        }
        return true;
      });
    }

    // Status filter
    if (this.filterStatus === 'visible') {
      result = result.filter(p => !p.isHidden);
    } else if (this.filterStatus === 'hidden') {
      result = result.filter(p => p.isHidden);
    } else if (!this.showHidden) {
      result = result.filter(p => !p.isHidden);
    }

    // Sort
    switch (this.sortBy) {
      case 'oldest':
        result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case 'most_views':
        result.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
        break;
      case 'most_votes':
        result.sort((a, b) => ((b.upvotes || 0) - (b.downvotes || 0)) - ((a.upvotes || 0) - (a.downvotes || 0)));
        break;
      default: // newest
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
    }

    this.filteredPosts = result;
    this.totalPages = Math.max(1, Math.ceil(result.length / this.pageSize));
    if (this.currentPage > this.totalPages) this.currentPage = 1;
    this.buildPageNumbers();
    this.updatePage();
    this.cdr.detectChanges();
  }

  buildPageNumbers() {
    const pages: number[] = [];
    const start = Math.max(1, this.currentPage - 2);
    const end = Math.min(this.totalPages, this.currentPage + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    this.pageNumbers = pages;
  }

  updatePage() {
    const start = (this.currentPage - 1) * this.pageSize;
    this.pagedPosts = this.filteredPosts.slice(start, start + this.pageSize);
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.buildPageNumbers();
    this.updatePage();
    this.cdr.detectChanges();
  }

  // Moderate modal
  openModerateModal(post: any, hide: boolean) {
    this.moderatingPost = post;
    this.moderateReason = '';
    this.isModerateModalOpen = true;
    this.cdr.detectChanges();
  }

  closeModerateModal() {
    this.isModerateModalOpen = false;
    this.moderatingPost = null;
    this.cdr.detectChanges();
  }

  confirmModerate() {
    if (!this.moderatingPost) return;
    this.moderatePost(this.moderatingPost.id, true, this.moderateReason);
    this.closeModerateModal();
  }

  moderatePost(postId: string, hide: boolean, reason: string) {
    const payload = { hidden: hide, reason: reason || null };
    this.http.post<any>(`/api/posts/${postId}/moderate`, payload).subscribe({
      next: (res) => {
        // Update in local list
        const idx = this.posts.findIndex(p => p.id === postId);
        if (idx !== -1) {
          this.posts[idx].isHidden = hide;
        }
        this.applyFilters();
        alert(hide ? 'Đã ẩn bài viết!' : 'Đã hiển thị lại bài viết!');
      },
      error: (err) => {
        console.error('Lỗi kiểm duyệt bài viết:', err);
        alert(`Lỗi ${err.status}: Không thể thực hiện thao tác kiểm duyệt.`);
      }
    });
  }

  // --- POST DETAIL MODAL ---
  openDetailModal(post: any) {
    this.selectedPostDetail = null;
    this.postComments = [];
    this.newCommentText = '';
    this.isDetailModalOpen = true;
    this.cdr.detectChanges();

    // Load post detail
    this.http.get<any>(`/api/posts/${post.id}`).subscribe({
      next: (res) => {
        this.selectedPostDetail = res?.data || res;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi tải chi tiết bài viết:', err);
      }
    });

    // Load comments (including hidden ones via admin access)
    this.loadPostComments(post.id);
  }

  loadPostComments(postId: string) {
    this.http.get<any>(`/api/posts/${postId}/comments`).subscribe({
      next: (res) => {
        this.postComments = res?.data || res || [];
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi tải bình luận:', err);
        this.postComments = [];
      }
    });
  }

  closeDetailModal() {
    this.isDetailModalOpen = false;
    this.selectedPostDetail = null;
    this.postComments = [];
    this.cdr.detectChanges();
  }

  moderateComment(commentId: string, hide: boolean) {
    const reason = hide ? (prompt('Lý do ẩn bình luận (tùy chọn):') ?? '') : '';
    this.http.post<any>(`/api/comments/${commentId}/moderate`, { hidden: hide, reason }).subscribe({
      next: () => {
        if (this.selectedPostDetail) this.loadPostComments(this.selectedPostDetail.id);
        alert(hide ? 'Đã ẩn bình luận!' : 'Đã hiển thị lại bình luận!');
      },
      error: (err) => {
        console.error('Lỗi kiểm duyệt bình luận:', err);
        alert('Không thể thực hiện thao tác!');
      }
    });
  }

  deleteComment(commentId: string) {
    if (!confirm('Xóa bình luận này vĩnh viễn?')) return;
    this.http.delete<any>(`/api/comments/${commentId}`).subscribe({
      next: () => {
        if (this.selectedPostDetail) this.loadPostComments(this.selectedPostDetail.id);
        alert('Đã xóa bình luận!');
      },
      error: (err) => {
        console.error('Lỗi xóa bình luận:', err);
        alert('Không thể xóa bình luận!');
      }
    });
  }

  submitAdminComment() {
    if (!this.newCommentText.trim() || !this.selectedPostDetail) return;
    const payload = { bodyMarkdown: this.newCommentText.trim() };
    this.http.post<any>(`/api/posts/${this.selectedPostDetail.id}/comments`, payload).subscribe({
      next: () => {
        this.newCommentText = '';
        this.loadPostComments(this.selectedPostDetail.id);
      },
      error: (err) => {
        console.error('Lỗi gửi bình luận:', err);
        alert('Không thể gửi bình luận!');
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
    return `${Math.floor(days / 30)} tháng trước`;
  }

  // --- POST DELETE ---
  deletePost(postId: string) {
    if (!confirm('⚠️ Xóa bài viết này là vĩnh viễn, không thể khôi phục. Bạn chắc chắn muốn xóa?')) return;
    this.http.delete<any>(`/api/posts/${postId}`).subscribe({
      next: () => {
        this.posts = this.posts.filter(p => p.id !== postId);
        this.applyFilters();
        alert('Đã xóa bài viết!');
      },
      error: (err) => {
        console.error('Lỗi xóa bài viết:', err);
        alert(`Lỗi ${err.status}: Không thể xóa bài viết.`);
      }
    });
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
}
