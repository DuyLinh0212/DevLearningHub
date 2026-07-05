import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Location } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { ForumService } from '../../core/services/forum.service';
import { QuizService } from '../../core/services/quiz.service';
import { ReviewStatusBadgeComponent } from '../../shared/components/review-status-badge/review-status-badge';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, ReviewStatusBadgeComponent],
  templateUrl: './user-profile.html',
  styleUrl: './user-profile.css'
})
export class UserProfileComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private forumService = inject(ForumService);
  private quizService = inject(QuizService);
  private location = inject(Location);

  isLoading = true;
  user: any = null;
  stats: any = null;
  posts: any[] = [];
  quizzes: any[] = [];
  problems: any[] = [];
  activeTab: string = 'posts';
  notFound = false;
  returnUrl: string = '/forum';

  currentLoggedInUserId = '';
  isOwnProfile = false;
  showEditModal = false;
  isSavingProfile = false;
  isUploadingAvatar = false;
  isUploadingBanner = false;
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
            error: () => {}
          });
        });

        // Tải bộ đề thi của người dùng này
        this.quizService.getAllQuizzes(true).subscribe({
          next: (quizSets) => {
            this.quizzes = (quizSets || []).filter(q => this.compareIds(q.createdBy, id));
            this.cdr.detectChanges();
          }
        });

        // Tải bài tập code của người dùng này
        this.http.get<any>('/api/problems').subscribe({
          next: (problemsRes) => {
            const data = problemsRes?.data || problemsRes;
            const list = Array.isArray(data) ? data : [];
            this.problems = list.filter((p: any) => this.compareIds(p.createdBy, id));
            this.cdr.detectChanges();
          }
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

  compareIds(id1: any, id2: any): boolean {
    if (!id1 || !id2) return false;
    return id1.toString().toLowerCase().trim() === id2.toString().toLowerCase().trim();
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
    if (this.isSavingProfile || this.isUploadingAvatar || this.isUploadingBanner) return;
    this.showEditModal = false;
    this.cdr.detectChanges();
  }

  saveProfile() {
    if (this.isUploadingAvatar || this.isUploadingBanner) return;

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

  onBannerFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Anh khong duoc vuot qua 5MB.');
      input.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    this.isUploadingBanner = true;
    this.cdr.detectChanges();

    this.http.post<any>('/api/users/me/banner', formData).pipe(
      finalize(() => { this.isUploadingBanner = false; this.cdr.detectChanges(); })
    ).subscribe({
      next: (res) => {
        const u = res?.data || res;
        const newUrl = u?.bannerUrl || '';
        this.editForm = { ...this.editForm, bannerUrl: newUrl };
        if (this.user) this.user.bannerUrl = newUrl;
        window.dispatchEvent(new Event('profile-updated'));
        this.cdr.detectChanges();
      },
      error: (err) => {
        alert(err?.error?.message || 'Khong the tai anh nen len.');
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
