import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar';
import { QuizService } from '../../../core/services/quiz.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-quiz-management',
  standalone: true,
  imports: [FormsModule, RouterLink, SidebarComponent, CommonModule],
  templateUrl: './quiz-management.html',
  styleUrl: './quiz-management.css'
})
export class QuizManagementComponent implements OnInit, OnDestroy {
  private quizService = inject(QuizService);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);

  currentSubTab: string = 'bank';
  searchTerm: string = '';
  selectedTopic: string = 'all';
  selectedLevel: string = 'all';
  private intervalId: any;

  topics: string[] = [
    'Lập trình Backend',
    'Lập trình Frontend',
    'Cơ sở dữ liệu',
    'Kiểm thử phần mềm',
    'Beginner'
  ];

  questionsBank: any[] = [];
  quizSets: any[] = [];
  selectedQuizSet: any = null;

  isQuestionModalOpen: boolean = false;
  isEditingQuestion: boolean = false;
  editingQuestionId: any = null;

  questionForm = {
    text: '',
    topic: 'Lập trình Backend',
    level: 'Trung bình',
    points: 10,
    options: ['', '', '', ''],
    correctIndex: 0,
    explanation: ''
  };

  isQuizSetModalOpen: boolean = false;
  isEditingQuizSet: boolean = false;
  editingQuizSetId: any = null;
  isAssignModalOpen: boolean = false;

  quizSetForm = {
    title: '',
    desc: '',
    description: '',
    topic: 'Lập trình Backend',
    level: 'Trung bình',
    duration: 15,
    passRate: 80,
    mode: 'practice',
    questionIds: [] as any[]
  };

  get filteredQuestions() {
    const list = this.questionsBank || [];
    return list.filter(q => {
      const matchSearch = (q.text || '').toLowerCase().includes(this.searchTerm.toLowerCase()) ||
                          (q.topic || '').toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchTopic = this.selectedTopic === 'all' || q.topic === this.selectedTopic;
      const matchLevel = this.selectedLevel === 'all' || q.level === this.selectedLevel;
      return matchSearch && matchTopic && matchLevel;
    });
  }

  get filteredQuizSets() {
    const list = this.quizSets || [];
    return list.filter(s => {
      const matchSearch = (s.title || '').toLowerCase().includes(this.searchTerm.toLowerCase()) ||
                          (s.description || '').toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchTopic = this.selectedTopic === 'all' || s.topic === this.selectedTopic;
      const matchLevel = this.selectedLevel === 'all' || s.level === this.selectedLevel;
      return matchSearch && matchTopic && matchLevel;
    });
  }

  ngOnInit() {
    this.loadQuestions();
    this.loadQuizSets();
  }

  ngOnDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  switchSubTab(tab: string) {
    this.currentSubTab = tab;
    this.selectedTopic = 'all';
    this.selectedLevel = 'all';
    this.searchTerm = '';
    this.cdr.detectChanges();
  }

  filterByTopic(topic: string) {
    this.selectedTopic = topic;
    this.cdr.detectChanges();
  }

  getLetterPrefix(index: number): string {
    const alphabet = ['A', 'B', 'C', 'D', 'E', 'F'];
    return alphabet[index] || '';
  }

  setCorrectAnswer(index: number) {
    this.questionForm.correctIndex = index;
    this.cdr.detectChanges();
  }

  shortenId(id: string | number): string {
    if (!id) return '';
    const strId = id.toString();
    if (strId.startsWith('new_') || strId.startsWith('custom_')) return strId;
    return strId.length > 8 ? strId.substring(0, 8) + '...' : strId;
  }

  loadQuestions() {
    this.http.get<any>('/api/questions').subscribe({
      next: (res: any) => {
        const rawData = res?.data || res || [];
        const dataArray = Array.isArray(rawData) ? rawData : [];
        
        this.questionsBank = dataArray.map((q: any) => {
          const rawOptions = q.options || q.Options || [];
          let cleanOptions: string[] = [];
          
          if (Array.isArray(rawOptions)) {
            cleanOptions = rawOptions.map((o: any) => {
              if (typeof o === 'string') return o;
              return o?.text || o?.content || o?.Content || '';
            });
          }

          return {
            id: q.id || q.Id,
            text: q.text || q.content || q.Content || 'Nội dung câu hỏi trống',
            topic: q.topic || q.Topic || 'Beginner',
            level: q.level || q.Level || 'Dễ',
            points: q.points ?? q.Points ?? 10,
            isActive: q.isActive ?? q.IsActive ?? true,
            options: cleanOptions,
            correctIndex: q.correctIndex ?? q.CorrectIndex ?? 0,
            explanation: q.explanation || q.Explanation || ''
          };
        });

        if (this.questionsBank.length === 0) {
          this.setFallbackQuestions();
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.setFallbackQuestions();
        this.cdr.detectChanges();
      }
    });
  }

  private setFallbackQuestions() {
    this.questionsBank = [
      { id: 'e7841aab-e444-46d9-980a-a6318b23235e', text: 'Để thực hiện kết nối và gọi API lấy dữ liệu trong Angular, chúng ta sử dụng Service nào?', topic: 'Beginner', level: 'Trung bình', points: 10, isActive: true, options: ['HttpClient', 'HttpModule', 'Router', 'ActivatedRoute'], correctIndex: 0, explanation: '' },
      { id: '187c9fe9-ceb2-4dea-84b0-f27b473342bc', text: 'Trong Angular v17, tính năng nào dùng để thay thế cho cấu trúc *ngFor truyền thống?', topic: 'Beginner', level: 'Dễ', points: 10, isActive: true, options: ['@for', '@if', '@switch', '@defer'], correctIndex: 0, explanation: '' }
    ];
  }

  loadQuizSets() {
    this.quizService.getAllQuizzes(true).subscribe({
      next: (res: any) => {
        const rawData = res?.data || res || [];
        const dataArray = Array.isArray(rawData) ? rawData : [];
        
        this.quizSets = dataArray.map((s: any) => ({
          id: s.id,
          title: s.title || '',
          desc: s.desc || s.description || '',
          description: s.description || s.desc || '',
          topic: s.topic || 'Beginner',
          level: s.level || 'Dễ',
          duration: s.duration || 15,
          questionsCount: s.questionsCount ?? s.questions ?? 0,
          statusClass: s.statusClass || 'public',
          status: s.status || 'Đã phát hành',
          questionIds: s.questionIds || []
        }));

        if (this.quizSets.length === 0) {
          this.setFallbackQuizSets();
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.setFallbackQuizSets();
        this.cdr.detectChanges();
      }
    });
  }

  private setFallbackQuizSets() {
    this.quizSets = [
      { id: 'q1', title: 'Bộ đề thi C# Core nâng cao', description: 'Kiểm tra kiến thức Linq, Dependency Injection và Async Await.', topic: 'Beginner', level: 'Trung bình', duration: 20, passRate: 80, questionsCount: 2, statusClass: 'public', status: 'Đã phát hành', questionIds: ['e7841aab-e444-46d9-980a-a6318b23235e', '187c9fe9-ceb2-4dea-84b0-f27b473342bc'] }
    ];
  }

  openQuestionModal(question: any = null) {
    if (question) {
      this.isEditingQuestion = true;
      this.editingQuestionId = question.id;
      this.questionForm = {
        text: question.text || '',
        topic: question.topic || 'Lập trình Backend',
        level: question.level || 'Trung bình',
        points: question.points || 10,
        options: question.options ? [...question.options] : ['', '', '', ''],
        correctIndex: question.correctIndex ?? 0,
        explanation: question.explanation || ''
      };
    } else {
      this.isEditingQuestion = false;
      this.editingQuestionId = null;
      this.questionForm = {
        text: '',
        topic: 'Lập trình Backend',
        level: 'Trung bình',
        points: 10,
        options: ['', '', '', ''],
        correctIndex: 0,
        explanation: ''
      };
    }
    this.isQuestionModalOpen = true;
    this.cdr.detectChanges();
  }

  closeQuestionModal() {
    this.isQuestionModalOpen = false;
    this.cdr.detectChanges();
  }

  trackByIndex(index: number): number {
    return index;
  }

  saveQuestion() {
    if (!this.questionForm.text.trim()) {
      alert('Vui lòng nhập nội dung câu hỏi!');
      return;
    }

    const request$ = this.isEditingQuestion && this.editingQuestionId
      ? this.http.put<any>(`/api/questions/${this.editingQuestionId}`, this.questionForm)
      : this.http.post<any>('/api/questions', this.questionForm);

    request$.subscribe({
      next: () => {
        this.loadQuestions();
        this.closeQuestionModal();
        alert('Cập nhật thông tin câu hỏi thành công!');
      },
      error: (err: any) => {
        alert(`Không thể lưu câu hỏi lên hệ thống Backend (Mã lỗi: ${err.status})`);
      }
    });
  }

  toggleQuestionStatus(q: any) {
    q.isActive = !q.isActive;
    this.cdr.detectChanges();
  }

  toggleQuizSetStatus(set: any) {
    this.quizService.toggleQuizStatus(set.id, set.statusClass).subscribe({
      next: () => {
        this.loadQuizSets();
      },
      error: (err: any) => {
        set.statusClass = set.statusClass === 'public' ? 'draft' : 'public';
        set.status = set.statusClass === 'public' ? 'Đã phát hành' : 'Bản nháp';
        this.cdr.detectChanges();
      }
    });
  }

  deleteQuestion(id: any) {
    if (confirm('Bạn có chắc chắn muốn xóa câu hỏi này khỏi ngân hàng đề thi không?')) {
      this.http.delete<any>(`/api/questions/${id}`).subscribe({
        next: () => {
          this.loadQuestions();
          alert('Đã xóa câu hỏi thành công!');
        },
        error: (err: any) => {
          this.questionsBank = this.questionsBank.filter(q => q.id !== id);
          this.cdr.detectChanges();
        }
      });
    }
  }

  openQuizSetModal(quizSet: any = null) {
    if (quizSet) {
      this.isEditingQuizSet = true;
      this.editingQuizSetId = quizSet.id;
      this.selectedQuizSet = quizSet;
      this.quizSetForm = {
        title: quizSet.title || '',
        desc: quizSet.desc || quizSet.description || '',
        description: quizSet.description || quizSet.desc || '',
        topic: quizSet.topic || 'Lập trình Backend',
        level: quizSet.level || 'Trung bình',
        duration: quizSet.duration || 15,
        passRate: quizSet.passRate || 80,
        mode: quizSet.mode || 'practice',
        questionIds: quizSet.questionIds ? [...quizSet.questionIds] : []
      };
    } else {
      this.isEditingQuizSet = false;
      this.editingQuizSetId = null;
      this.selectedQuizSet = null;
      this.quizSetForm = {
        title: '',
        desc: '',
        description: '',
        topic: 'Lập trình Backend',
        level: 'Trung bình',
        duration: 15,
        passRate: 80,
        mode: 'practice',
        questionIds: []
      };
    }
    this.isQuizSetModalOpen = true;
    this.cdr.detectChanges();
  }

  closeQuizSetModal() {
    this.isQuizSetModalOpen = false;
    this.cdr.detectChanges();
  }

  openAssignModal(quizSet: any) {
    this.selectedQuizSet = quizSet;
    this.isAssignModalOpen = true;
    this.isQuizSetModalOpen = false;
    this.quizSetForm = {
      title: quizSet.title || '',
      desc: quizSet.desc || quizSet.description || '',
      description: quizSet.description || quizSet.desc || '',
      topic: quizSet.topic || 'Lập trình Backend',
      level: quizSet.level || 'Trung bình',
      duration: quizSet.duration || 15,
      passRate: quizSet.passRate || 80,
      mode: quizSet.mode || 'practice',
      questionIds: quizSet.questionIds ? [...quizSet.questionIds] : []
    };
    this.cdr.detectChanges();
  }

  toggleQuestionInSet(qId: any) {
    if (!this.selectedQuizSet) return;
    
    const idx = this.quizSetForm.questionIds.indexOf(qId);
    if (idx > -1) {
      this.quizService.removeQuestionFromSet(this.selectedQuizSet.id, qId).subscribe({
        next: () => {
          this.quizSetForm.questionIds.splice(idx, 1);
          this.selectedQuizSet.questionsCount = this.quizSetForm.questionIds.length;
          this.cdr.detectChanges();
        },
        error: () => {
          this.quizSetForm.questionIds.splice(idx, 1);
          this.selectedQuizSet.questionsCount = this.quizSetForm.questionIds.length;
          this.cdr.detectChanges();
        }
      });
    } else {
      this.quizService.assignQuestionToSet(this.selectedQuizSet.id, qId).subscribe({
        next: () => {
          this.quizSetForm.questionIds.push(qId);
          this.selectedQuizSet.questionsCount = this.quizSetForm.questionIds.length;
          this.cdr.detectChanges();
        },
        error: () => {
          this.quizSetForm.questionIds.push(qId);
          this.selectedQuizSet.questionsCount = this.quizSetForm.questionIds.length;
          this.cdr.detectChanges();
        }
      });
    }
  }

  isQuestionSelectedInQuizSet(qId: any): boolean {
    return this.quizSetForm.questionIds.includes(qId);
  }

  isQuestionInSet(qId: any): boolean {
    return this.quizSetForm.questionIds.includes(qId);
  }

  closeAssignModal() {
    this.isAssignModalOpen = false;
    this.selectedQuizSet = null;
    this.loadQuizSets();
    this.cdr.detectChanges();
  }

  saveQuizSet() {
    if (!this.quizSetForm.title?.trim()) {
        alert('Vui lòng nhập tiêu đề!');
        return;
    }

    const payload = {
        title: this.quizSetForm.title.trim(),
        description: this.quizSetForm.desc || '',
        mode: this.quizSetForm.mode || 'practice',
        timeLimitSeconds: (this.quizSetForm.duration || 15) * 60, 
        isPublic: true,
        topicId: this.selectedQuizSet?.topicId || null, 
        level: this.quizSetForm.level || 'beginner'
    };

    const targetId = this.isEditingQuizSet && this.editingQuizSetId ? this.editingQuizSetId : 'custom_' + Date.now();
    
    this.quizService.saveQuizSetFromAdmin(targetId, payload).subscribe({
        next: () => {
            this.loadQuizSets();
            this.closeQuizSetModal();
            alert('Lưu thành công!');
        },
        error: (err: any) => {
            console.error('Lỗi Payload:', payload);
            alert(`Backend từ chối dữ liệu (Mã lỗi: ${err.status})`);
        }
    });
}

  deleteQuizSet(id: any) {
    if (confirm('Xác nhận xóa hoàn toàn bộ đề thi này khỏi hệ thống phân phối?')) {
      this.quizService.deleteQuizSet(id).subscribe({
        next: () => {
          this.loadQuizSets();
          alert('Đã xóa bộ đề thi thành công!');
        },
        error: () => {
          this.quizSets = this.quizSets.filter(s => s.id !== id);
          this.cdr.detectChanges();
        }
      });
    }
  }
}