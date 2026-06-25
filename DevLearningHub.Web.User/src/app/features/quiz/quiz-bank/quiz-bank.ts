import { Component, inject, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { QuizService } from '../../../core/services/quiz.service';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-quiz-bank',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './quiz-bank.html',
  styleUrl: './quiz-bank.css'
})
export class QuizBankComponent implements OnInit {
  private quizService = inject(QuizService);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);
  private http = inject(HttpClient);

  quizzes: any[] = [];
  searchText: string = '';
  selectedStatus: string = 'all';
  currentUserId: string = '';
  activeQuizMenuId: string | null = null;

  ngOnInit() {
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
        }
        this.loadQuizzes();
      },
      error: (err) => {
        console.error('Lỗi lấy thông tin cá nhân tại Kho đề:', err);
        this.loadQuizzes();
      }
    });
  }

loadQuizzes() {
  console.log('=== USER_BANK: KHỞI CHẠY DEBUG ĐỂ TÌM BỘ ĐỀ ===');
  
  const hasToken = typeof window !== 'undefined' && Boolean(localStorage.getItem('accessToken') || localStorage.getItem('token'));

  this.quizService.getAllQuizzes(hasToken).subscribe({
    next: (res: any[]) => {
      console.log('👉 [DEBUG DỮ LIỆU TỪ SERVICE]:', res);
      
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
          updated: 'Mới cập nhật',
          allowedCopy: quiz.allowedCopy ?? false
        };
      });
      
      console.log('🎯 [MẢNG CUỐI CÙNG SAU KHI MAP]:', this.quizzes);
      this.cdr.detectChanges();
    },
    error: (err) => {
      console.error('❌ [DEBUG LỖI API]:', err);
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

      if (this.selectedStatus === 'all') {
        return matchesSearch;
      } else if (this.selectedStatus === 'public') {
        return matchesSearch && statusClass === 'public';
      } else if (this.selectedStatus === 'draft') {
        return matchesSearch && statusClass === 'draft';
      }
      return matchesSearch;
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
}
