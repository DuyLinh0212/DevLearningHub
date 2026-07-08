import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { QuizService } from '../../../core/services/quiz.service';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-quiz-bank',
  standalone: true,
  imports: [RouterLink, CommonModule, FormsModule],
  templateUrl: './quiz-bank.html',
  styleUrl: './quiz-bank.css'
})
export class QuizBankComponent implements OnInit, OnDestroy {
  private quizService = inject(QuizService);
  private route = inject(ActivatedRoute);
  public cdr = inject(ChangeDetectorRef);
  private http = inject(HttpClient);
  private router = inject(Router);

  quizzes: any[] = [];
  topics: any[] = [];
  searchText: string = '';
  // Status filter buckets: all | published | pending | private (review-status aware, owner-aware).
  selectedStatus: string = 'all';
  selectedTopicId: string = '';
  selectedDifficulty: string = '';
  currentUserId: string = '';
  activeQuizMenuId: string | null = null;
  // Viewport-relative coordinates for the open row menu. The menu is rendered with
  // position:fixed so it escapes the list's overflow clipping (the scroll container
  // otherwise cut off the dropdown and hid the "Xóa"/delete item).
  quizMenuPos: { top: number; right: number } = { top: 0, right: 0 };

  ngOnInit() {
    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', this.onAnyScroll, true);
    }
    this.loadCurrentUser();

    // LẮNG NGHE ĐƯỜNG DẪN URL ĐỂ BẮT TỪ KHÓA TÌM KIẾM TỪ SIDEBAR CHUYỂN SANG
    this.route.queryParams.subscribe(params => {
      if (params['search']) {
        this.searchText = params['search'].trim();
      } else {
        this.searchText = '';
      }
      this.cdr.detectChanges();
    });
  }

  getTopicProblemCount(topicId: string): number {
    if (!this.quizzes) return 0;
    const searchId = (topicId || '').toString().toLowerCase();
    return this.quizzes.filter(q => (q.topicId || '').toString().toLowerCase() === searchId).length;
  }

  getDifficultyLabel(level: string): string {
    const l = (level || '').toLowerCase();
    if (l === 'beginner' || l === 'easy') return 'Dễ';
    if (l === 'intermediate' || l === 'medium') return 'Trung bình';
    if (l === 'advanced' || l === 'hard') return 'Khó';
    return 'Dễ';
  }

  getDifficultyClass(level: string): string {
    const l = (level || '').toLowerCase();
    if (l === 'beginner' || l === 'easy') return 'diff-easy';
    if (l === 'intermediate' || l === 'medium') return 'diff-medium';
    if (l === 'advanced' || l === 'hard') return 'diff-hard';
    return 'diff-easy';
  }

  toggleQuizMenu(quizId: string, event: Event) {
    event.stopPropagation();
    const willOpen = this.activeQuizMenuId !== quizId;
    if (willOpen) {
      const trigger = (event.currentTarget as HTMLElement) || (event.target as HTMLElement);
      const rect = trigger.getBoundingClientRect();
      // Anchor the fixed-position menu just below the button and align its right edge.
      this.quizMenuPos = {
        top: Math.round(rect.bottom + 4),
        right: Math.round(window.innerWidth - rect.right)
      };
    }
    this.activeQuizMenuId = willOpen ? quizId : null;
    this.cdr.detectChanges();
  }

  // Close the row menu on any scroll: a fixed-position menu would otherwise stay pinned to the
  // viewport while its row scrolls away underneath. Capture phase catches inner scroll
  // containers (the table/dashboard scroll body) too, since scroll events do not bubble.
  private readonly onAnyScroll = () => {
    if (this.activeQuizMenuId !== null) {
      this.activeQuizMenuId = null;
      this.cdr.detectChanges();
    }
  };

  ngOnDestroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', this.onAnyScroll, true);
    }
  }

  shareQuiz(quizId: string, event: Event) {
    event.stopPropagation();
    const shareUrl = `${window.location.origin}/quiz/${quizId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      alert('Đã sao chép liên kết bộ đề ôn tập!');
    }).catch(err => {
      console.error('Không thể sao chép liên kết:', err);
    });
  }

  @HostListener('document:click')
  onDocumentClick() {
    this.activeQuizMenuId = null;
    this.cdr.detectChanges();
  }

  loadCurrentUser() {
    this.http.get<any>('/api/users/me').subscribe({
      next: (res) => {
        const user = res?.data || res;
        if (user) {
          this.currentUserId = (user.id || user.Id || user.userId || user.sub || '').toString().toLowerCase();
        }
        this.loadTopicsAndQuizzes();
      },
      error: (err) => {
        console.error('Loi lay thong tin ca nhan tai Kho de:', err);
        this.loadTopicsAndQuizzes();
      }
    });
  }

  onCreateQuizClick() {
    const hasToken = typeof window !== 'undefined' && Boolean(localStorage.getItem('accessToken') || localStorage.getItem('token'));
    if (!hasToken) {
      alert('Vui long dang nhap de tao bo de!');
      this.router.navigate(['/login']);
      return;
    }

    // Ownership-based: any logged-in user can create/edit quizzes.
    this.router.navigate(['/quiz-create']);
  }

  loadTopicsAndQuizzes() {
    // Tải danh sách topics
    this.http.get<any>('/api/topics').subscribe({
      next: (res) => {
        const data = res?.data || res;
        this.topics = Array.isArray(data) ? data : [];
        this.loadQuizzes();
      },
      error: (err) => {
        console.error('Lỗi tải danh sách chủ đề:', err);
        this.loadQuizzes();
      }
    });
  }

  loadQuizzes() {
    console.log('=== USER_BANK: KHỞI CHẠY KHẢO SÁT BỘ ĐỀ ===');
    const hasToken = typeof window !== 'undefined' && Boolean(localStorage.getItem('accessToken') || localStorage.getItem('token'));
  
    this.quizService.getAllQuizzes(hasToken).subscribe({
      next: (res: any[]) => {
        this.quizzes = res.map((quiz: any) => {
          return {
            id: quiz.id,
            createdBy: quiz.createdBy,
            title: quiz.title,
            desc: quiz.desc || 'Chưa có mô tả.',
            questions: quiz.questionsCount || 0, 
            duration: quiz.duration || 15,
            attempts: quiz.attempts || 0,
            statusClass: quiz.statusClass,
            status: quiz.status,
            topicId: quiz.topicId || '',
            level: quiz.level || 'beginner',
            allowedCopy: quiz.allowedCopy ?? quiz.AllowedCopy ?? true,
            reviewStatus: quiz.reviewStatus,
            updated: 'Mới cập nhật'
          };
        });
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi API bộ đề:', err);
        this.quizzes = [];
        this.cdr.detectChanges();
      }
    });
  }

  // The learner-facing state of a quiz set, combining ownership + review status. This is what
  // lets an author see and open their OWN sets that are still "Chờ duyệt" (pending) or "Bị từ chối"
  // (rejected) — states the plain public/private flag alone can't express.
  getQuizState(quiz: any): 'published' | 'pending' | 'rejected' | 'private' {
    const review = (quiz?.reviewStatus || '').toString().toLowerCase();
    if (this.isMyQuiz(quiz)) {
      if (review === 'pending') return 'pending';
      if (review === 'rejected') return 'rejected';
      return quiz?.statusClass === 'public' ? 'published' : 'private';
    }
    // Sets from other authors are only ever listed once approved & public.
    return 'published';
  }

  getStateLabel(state: string): string {
    switch (state) {
      case 'pending': return 'Chờ duyệt';
      case 'rejected': return 'Bị từ chối';
      case 'private': return 'Riêng tư';
      default: return 'Đã phát hành';
    }
  }

  // Which filter bucket a set belongs to. Rejected sets sit with private drafts — both are
  // owner-only, off the public shelf — so the author still finds them under "Riêng tư".
  private matchesStatusBucket(quiz: any, bucket: string): boolean {
    if (bucket === 'all') return true;
    const state = this.getQuizState(quiz);
    if (bucket === 'private') return state === 'private' || state === 'rejected';
    return state === bucket;
  }

  statusCount(bucket: string): number {
    if (!Array.isArray(this.quizzes)) return 0;
    return this.quizzes.filter(quiz => this.matchesStatusBucket(quiz, bucket)).length;
  }

  // Counts scoped to the current author, for the "Bộ đề của bạn" side panel.
  myStatusCount(bucket: string): number {
    if (!Array.isArray(this.quizzes)) return 0;
    return this.quizzes.filter(quiz => this.isMyQuiz(quiz) && this.matchesStatusBucket(quiz, bucket)).length;
  }

  // Zero-padded 2-digit row index for the editor-gutter line numbers.
  pad2(n: number): string {
    return (n < 10 ? '0' : '') + n;
  }

  changeStatus(status: string) {
    this.selectedStatus = status;
    this.cdr.detectChanges();
  }

  get filteredQuizzes(): any[] {
    if (!Array.isArray(this.quizzes)) return [];

    return this.quizzes.filter(quiz => {
      const title = (quiz.title || '').toString().toLowerCase();
      const desc = (quiz.desc || '').toString().toLowerCase();
      const searchLower = this.searchText.toLowerCase();
      const matchesSearch = title.includes(searchLower) || desc.includes(searchLower);

      const matchesStatus = this.matchesStatusBucket(quiz, this.selectedStatus);
      const matchesTopic = !this.selectedTopicId || (quiz.topicId || '').toString().toLowerCase() === this.selectedTopicId.toLowerCase();
      
      const qLevel = (quiz.level || 'beginner').toString().toLowerCase();
      let matchesDiff = true;
      if (this.selectedDifficulty) {
        if (this.selectedDifficulty === 'easy') {
          matchesDiff = qLevel === 'beginner' || qLevel === 'easy';
        } else if (this.selectedDifficulty === 'medium') {
          matchesDiff = qLevel === 'intermediate' || qLevel === 'medium';
        } else if (this.selectedDifficulty === 'hard') {
          matchesDiff = qLevel === 'advanced' || qLevel === 'hard';
        }
      }

      return matchesSearch && matchesStatus && matchesTopic && matchesDiff;
    });
  }

  onSearchChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input) {
      this.searchText = input.value;
      this.cdr.detectChanges();
    }
  }

  copyQuizSet(quizId: string, event: Event) {
    event.stopPropagation();
    if (!confirm('Bạn có chắc chắn muốn sao chép bộ đề này thành bộ đề của bạn không?')) return;
    this.quizService.copyQuizSet(quizId).subscribe({
      next: (res) => {
        alert('Sao chép bộ đề thành công! Bộ đề sao chép đang ở trạng thái Bản nháp.');
        this.loadQuizzes();
      },
      error: (err) => {
        console.error('Lỗi sao chép bộ đề:', err);
        alert(`Không thể sao chép bộ đề: ${err.error?.message || 'Có lỗi xảy ra.'}`);
      }
    });
  }

  deleteQuiz(quizId: string, event: Event) {
    event.stopPropagation();
    if (confirm('Bạn có chắc chắn muốn xóa bộ đề ôn luyện này không?')) {
      this.quizService.deleteQuizSet(quizId).subscribe({
        next: () => {
          alert('Đã xóa bộ đề thành công!');
          this.loadQuizzes();
        },
        error: (err: any) => {
          alert('Không thể xóa bộ đề. Có thể bộ đề đã có lượt tham gia hoặc bạn không có quyền.');
          console.error(err);
        }
      });
    }
  }

  compareIds(id1: any, id2: any): boolean {
    if (!id1 || !id2) return false;
    return id1.toString().toLowerCase().trim() === id2.toString().toLowerCase().trim();
  }

  isMyQuiz(quiz: any): boolean {
    return this.compareIds(quiz?.createdBy, this.currentUserId);
  }

  copyQuiz(quiz: any, event: Event) {
    event.stopPropagation();

    if (quiz.statusClass !== 'public') {
      alert('Chỉ có thể sao chép bộ đề đã phát hành.');
      return;
    }

    if (quiz.allowedCopy === false) {
      alert('Người tạo đã chặn sao chép bộ đề này.');
      return;
    }

    if (!confirm(`Bạn muốn sao chép bộ đề "${quiz.title}"?`)) {
      return;
    }

    this.http.post<any>(`/api/quiz-sets/${quiz.id}/copy`, {}).subscribe({
      next: () => {
        alert('Đã sao chép bộ đề thành công!');
        this.loadQuizzes();
      },
      error: (err) => {
        console.error(err);
        alert(err?.error?.message || 'Không thể sao chép bộ đề này.');
      }
    });
  }
}
