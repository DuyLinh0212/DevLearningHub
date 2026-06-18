import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Location } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ForumService } from '../../core/services/forum.service';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './user-profile.html',
  styleUrl: './user-profile.css'
})
export class UserProfileComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private forumService = inject(ForumService);
  private location = inject(Location);

  isLoading = true;
  user: any = null;
  stats: any = null;
  posts: any[] = [];
  notFound = false;
  returnUrl: string = '/forum';

  ngOnInit() {
    // Lấy returnUrl từ navigation state (nếu có)
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras?.state as { returnUrl?: string };
    if (state?.returnUrl) {
      this.returnUrl = state.returnUrl;
    }
    
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.notFound = true; this.isLoading = false; this.cdr.detectChanges(); return; }
    this.loadProfile(id);
  }

  loadProfile(id: string) {
    this.isLoading = true;
    forkJoin({
      stats: this.http.get<any>(`/api/users/${id}/stats`).pipe(catchError(() => of(null))),
      posts: this.http.get<any>(`/api/posts?authorId=${id}&pageSize=20`).pipe(catchError(() => of(null)))
    }).subscribe({
      next: (res) => {
        if (!res.stats) { this.notFound = true; this.isLoading = false; this.cdr.detectChanges(); return; }
        const s = res.stats?.data || res.stats;
        
        // Lấy user info từ bài viết đầu tiên (nếu có) hoặc khởi tạo rỗng
        const postData = res.posts?.data || res.posts;
        const items = postData?.items || (Array.isArray(postData) ? postData : []);
        
        this.user = {
          id: s.userId || (items.length > 0 ? items[0].author?.id : null),
          fullName: items.length > 0 ? items[0].author?.fullName : null,
          username: items.length > 0 ? items[0].author?.username : null,
          avatarUrl: items.length > 0 ? items[0].author?.avatarUrl : null,
          bio: 'Thành viên Dev Learning Hub',
          xpPoints: s.totalXP ?? 0
        };
        
        this.stats = {
          totalQuizTaken: s.totalQuizTaken ?? 0,
          totalXP: s.totalXP ?? 0,
          avgScore: s.avgScore ?? 0,
          rank: s.rank ?? 0,
          totalUpvotes: s.totalUpvotes ?? 0,
          totalComments: s.totalComments ?? 0
        };
        
        this.posts = items;
        
        // Tải chi tiết bài viết bất đồng bộ để lấy imageUrl & bodyMarkdown (giống forum)
        // Metrics (upvotes, commentCount, viewCount) đã có từ list endpoint
        this.posts.forEach(post => {
          this.forumService.getPost(post.id).subscribe({
            next: (detail) => {
              if (detail) {
                post.bodyMarkdown = detail.bodyMarkdown;
                post.imageUrl = detail.imageUrl;
                // Lấy trạng thái vote của user hiện tại để giữ màu tim
                post.myVote = detail.myVote || null;
                // Chỉ update metrics nếu list endpoint không có (fallback)
                if (!post.upvotes) post.upvotes = detail.upvotes || 0;
                if (!post.commentCount) post.commentCount = detail.commentCount || 0;
                if (!post.viewCount) post.viewCount = detail.viewCount || 0;
                this.cdr.detectChanges();
              }
            },
            error: () => {} // Bỏ qua lỗi, giữ dữ liệu cũ
          });
        });
        
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.notFound = true; this.isLoading = false; this.cdr.detectChanges(); }
    });
  }

  viewPost(postId: string) {
    this.router.navigate(['/forum/post', postId]);
  }

  formatRelativeTime(dateString: string): string {
    if (!dateString) return '';
    const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (seconds < 60) return 'Vua xong';
    const m = Math.floor(seconds / 60); if (m < 60) return `${m} phut truoc`;
    const h = Math.floor(m / 60); if (h < 24) return `${h} gio truoc`;
    const d = Math.floor(h / 24); if (d < 30) return `${d} ngay truoc`;
    return `${Math.floor(d / 30)} thang truoc`;
  }

  onAvatarError(e: Event) {
    const img = e.target as HTMLImageElement;
    if (img) img.src = 'assets/images/default-avatar.svg';
  }

  goBack() {
    this.router.navigate([this.returnUrl]);
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
}