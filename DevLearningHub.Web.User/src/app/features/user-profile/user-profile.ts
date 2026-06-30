import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Location } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { ForumService } from '../../core/services/forum.service';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
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

  currentLoggedInUserId = '';
  isOwnProfile = false;
  showEditModal = false;
  isSavingProfile = false;
  isUploadingAvatar = false;
  editForm = { fullName: '', bio: '', avatarUrl: '', bannerUrl: '' };

  ngOnInit() {
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras?.state as { returnUrl?: string };
    if (state?.returnUrl) {
      this.returnUrl = state.returnUrl;
    }

    this.loadCurrentUser();

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.notFound = true; this.isLoading = false; this.cdr.detectChanges(); return; }
    this.loadProfile(id);
  }

  private loadCurrentUser() {
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    if (!token) return;
    this.http.get<any>('/api/users/me').subscribe({
      next: (res) => {
        const u = res?.data || res;
        this.currentLoggedInUserId = (u?.id || '').toLowerCase();
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  loadProfile(id: string) {
    this.isLoading = true;
    forkJoin({
      user: this.http.get<any>(`/api/users/${id}`).pipe(catchError(() => of(null))),
      stats: this.http.get<any>(`/api/users/${id}/stats`).pipe(catchError(() => of(null))),
      posts: this.http.get<any>(`/api/posts?authorId=${id}&pageSize=20`).pipe(catchError(() => of(null)))
    }).subscribe({
      next: (res) => {
        if (!res.user) { this.notFound = true; this.isLoading = false; this.cdr.detectChanges(); return; }
        const u = res.user?.data || res.user;
        const s = res.stats?.data || res.stats;
        
        const postData = res.posts?.data || res.posts;
        const items = postData?.items || (Array.isArray(postData) ? postData : []);
        
        this.user = {
          id: u.id,
          fullName: u.fullName || u.username,
          username: u.username,
          avatarUrl: u.avatarUrl,
          bannerUrl: u.bannerUrl || null,
          bio: u.bio || 'Thành viên Dev Learning Hub',
          xpPoints: u.xpPoints ?? s?.totalXP ?? 0,
          roles: u.roles || []
        };
        this.isOwnProfile = (u.id || '').toLowerCase() === this.currentLoggedInUserId;
        
        this.stats = {
          totalQuizTaken: s?.totalQuizTaken ?? 0,
          totalXP: s?.totalXP ?? u.xpPoints ?? 0,
          avgScore: s?.avgScore ?? 0,
          rank: s?.rank ?? 0,
          totalUpvotes: s?.totalUpvotes ?? 0,
          totalComments: s?.totalComments ?? 0
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

  hasRole(roleName: string): boolean {
    return this.user?.roles?.some((r: string) => r.toLowerCase() === roleName.toLowerCase()) || false;
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

  openEditModal() {
    this.editForm = {
      fullName: this.user?.fullName || '',
      bio: (this.user?.bio === 'Thành viên Dev Learning Hub' ? '' : this.user?.bio) || '',
      avatarUrl: this.user?.avatarUrl || '',
      bannerUrl: this.user?.bannerUrl || ''
    };
    this.showEditModal = true;
    this.cdr.detectChanges();
  }

  closeEditModal() {
    if (this.isSavingProfile) return;
    this.showEditModal = false;
    this.cdr.detectChanges();
  }

  saveProfile() {
    this.isSavingProfile = true;
    this.cdr.detectChanges();

    const payload = {
      fullName: this.editForm.fullName.trim() || null,
      bio: this.editForm.bio.trim() || null,
      avatarUrl: this.editForm.avatarUrl.trim() || null,
      bannerUrl: this.editForm.bannerUrl.trim() || null
    };

    this.http.put<any>('/api/users/me', payload).pipe(
      finalize(() => {
        this.isSavingProfile = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (res) => {
        const u = res?.data || res;
        if (this.user) {
          this.user.fullName = u.fullName || this.user.username;
          this.user.bio = u.bio || 'Thành viên Dev Learning Hub';
          this.user.avatarUrl = u.avatarUrl;
          this.user.bannerUrl = u.bannerUrl;
        }
        this.showEditModal = false;
        window.dispatchEvent(new Event('profile-updated'));
      },
      error: (err) => {
        alert(err?.error?.message || 'Không thể cập nhật thông tin.');
      }
    });
  }

  onAvatarFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Ảnh không được vượt quá 5MB.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    this.isUploadingAvatar = true;
    this.cdr.detectChanges();

    this.http.post<any>('/api/users/me/avatar', formData).pipe(
      finalize(() => { this.isUploadingAvatar = false; this.cdr.detectChanges(); })
    ).subscribe({
      next: (res) => {
        const u = res?.data || res;
        const newUrl = u?.avatarUrl || '';
        this.editForm = { ...this.editForm, avatarUrl: newUrl };
        if (this.user) this.user.avatarUrl = newUrl;
        window.dispatchEvent(new Event('profile-updated'));
        this.cdr.detectChanges();
      },
      error: (err) => {
        alert(err?.error?.message || 'Không thể tải ảnh lên.');
      }
    });
    input.value = '';
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