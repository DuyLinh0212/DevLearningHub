import { Component, inject, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
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
export class QuizBankComponent implements OnInit {
  private quizService = inject(QuizService);
  private route = inject(ActivatedRoute);
  public cdr = inject(ChangeDetectorRef);
  private http = inject(HttpClient);
  private router = inject(Router);

  quizzes: any[] = [];
  topics: any[] = [];
  searchText: string = '';
  selectedStatus: string = 'all';
  selectedTopicId: string = '';
  selectedDifficulty: string = '';
  currentUserId: string = '';
  currentUserPermissions: string[] = [];
  activeQuizMenuId: string | null = null;

  // Calendar properties
  calendarDays: (number | null)[] = [];
  currentDay = new Date().getDate();
  currentMonthYearLabel = '';

  ngOnInit() {
    this.generateCalendar();
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

  generateCalendar() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const monthNames = [
      'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
      'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
    ];
    this.currentMonthYearLabel = `${monthNames[month]} ${year}`;
    
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= totalDays; i++) {
      days.push(i);
    }
    this.calendarDays = days;
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
    this.activeQuizMenuId = this.activeQuizMenuId === quizId ? null : quizId;
    this.cdr.detectChanges();
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
          this.currentUserPermissions = (user.permissions || []).map((p: string) => (p || '').toLowerCase());
        }
        this.loadTopicsAndQuizzes();
      },
      error: (err) => {
        console.error('Lỗi lấy thông tin cá nhân tại Kho đề:', err);
        this.loadTopicsAndQuizzes();
      }
    });
  }

  hasPermission(permission: string): boolean {
    const target = (permission || '').toLowerCase();
    return this.currentUserPermissions.includes(target)
      || this.currentUserPermissions.includes('system.full_control');
  }

  onCreateQuizClick() {
    const hasToken = typeof window !== 'undefined' && Boolean(localStorage.getItem('accessToken') || localStorage.getItem('token'));
    if (!hasToken) {
      alert('Vui lòng đăng nhập để tạo bộ đề!');
      this.router.navigate(['/login']);
      return;
    }

    if (this.hasPermission('quiz:create') || this.hasPermission('quiz:edit')) {
      this.router.navigate(['/quiz-create']);
    } else {
      alert('Bạn không có quyền tạo bộ đề thi!');
    }
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

  get filteredQuizzes(): any[] {
    if (!Array.isArray(this.quizzes)) return [];

    return this.quizzes.filter(quiz => {
      const title = (quiz.title || '').toString().toLowerCase();
      const desc = (quiz.desc || '').toString().toLowerCase();
      const statusClass = (quiz.statusClass || 'public').toString().toLowerCase();
      const searchLower = this.searchText.toLowerCase();
      const matchesSearch = title.includes(searchLower) || desc.includes(searchLower);

      const matchesStatus = this.selectedStatus === 'all' || statusClass === this.selectedStatus;
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

  changeFilter(status: string) {
    this.selectedStatus = status;
    this.cdr.detectChanges();
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
