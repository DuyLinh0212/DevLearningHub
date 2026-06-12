import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { QuizService } from '../../../core/services/quiz.service';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-quiz-bank',
  standalone: true,
  imports: [RouterLink, SidebarComponent, CommonModule],
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

  this.http.get<any>('/api/quiz-sets', {
    params: hasToken ? { includePrivate: true } : {}
  }).subscribe({
    next: (res: any) => {
      // 1. In hẳn dữ liệu gốc của Nam trả về xem có gì bên trong
      console.log('👉 [DEBUG DỮ LIỆU GỐC TỪ BACKEND]:', res);
      
      const rawSets = res?.data || res || [];
      const dataArray = Array.isArray(rawSets) ? rawSets : [];
      
      this.quizzes = dataArray.map((quiz: any) => {
        // Log chi tiết từng bộ đề xem trường số câu hỏi là bao nhiêu
        console.log(`🔍 Quét thấy bộ đề: ${quiz.title} | questionCount gốc từ API =`, quiz.questionCount);

        return {
          id: quiz.id || quiz.Id,
          createdBy: quiz.createdBy || quiz.CreatedBy || '',
          title: quiz.title || 'Bộ đề chưa đặt tên',
          desc: quiz.description || 'Chưa có mô tả.',
          questions: quiz.questionCount ?? quiz.QuestionCount ?? 0, 
          duration: quiz.timeLimitSeconds ? Math.floor(quiz.timeLimitSeconds / 60) : 15,
          attempts: quiz.attempts || 0,
          statusClass: quiz.isPublic ? 'public' : 'draft',
          status: quiz.isPublic ? 'Đã phát hành' : 'Bản nháp',
          updated: 'Mới cập nhật'
        };
      });
      
      // XÓA BỎ BỘ LỌC ĐIỀU KIỆN (Để đề 0 câu hay đề ẩn cũng phải hiện lên màn hình để check)
      console.log('🎯 [MẢNG CUỐI CÙNG SAU KHI MAP]:', this.quizzes);
      this.cdr.detectChanges();
    },
    error: (err) => {
      // Nếu dính lỗi 403 hoặc 401, dòng này sẽ in ra thủ phạm ngay
      console.error('❌ [DEBUG LỖI API]: Học viên gọi API bị Server từ chối!', err);
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

  compareIds(id1: any, id2: any): boolean {
    if (!id1 || !id2) return false;
    return id1.toString().toLowerCase().trim() === id2.toString().toLowerCase().trim();
  }
}
