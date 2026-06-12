import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
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

  topics: any[] = [];
  questionsBank: any[] = [];
  quizSets: any[] = [];
  selectedQuizSet: any = null;
  activeQuizSetMenuId: any = null;
  isLoadingAssignQuestions: boolean = false;
  assignSearchTerm: string = '';

  isQuestionModalOpen: boolean = false;
  isEditingQuestion: boolean = false;
  editingQuestionId: any = null;

  questionForm = {
    text: '',
    topicId: '',
    level: 'beginner',
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
    topicId: '',
    level: 'beginner',
    duration: 15,
    passRate: 80,
    mode: 'practice',
    questionIds: [] as any[]
  };

  get filteredQuestions() {
    const list = this.questionsBank || [];
    return list.filter(q => {
      const matchSearch = (q.text || '').toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchTopic = this.selectedTopic === 'all' || q.topicId === this.selectedTopic;
      const matchLevel = this.selectedLevel === 'all' || q.level === this.selectedLevel;
      return matchSearch && matchTopic && matchLevel;
    });
  }

  get filteredQuizSets() {
    const list = this.quizSets || [];
    return list.filter(s => {
      const matchSearch = (s.title || '').toLowerCase().includes(this.searchTerm.toLowerCase()) ||
                          (s.description || '').toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchTopic = this.selectedTopic === 'all' || s.topicId === this.selectedTopic;
      const matchLevel = this.selectedLevel === 'all' || s.level === this.selectedLevel;
      return matchSearch && matchTopic && matchLevel;
    });
  }

  get assignableQuestions() {
    const search = this.assignSearchTerm.trim().toLowerCase();
    return (this.questionsBank || []).filter(q => {
      const belongsToTopic = !this.selectedQuizSet?.topicId || q.topicId === this.selectedQuizSet.topicId;
      const matchesSearch = !search || (q.text || '').toLowerCase().includes(search);
      return q.isActive && belongsToTopic && matchesSearch;
    });
  }

  ngOnInit() {
    this.loadTopics();
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

  filterByTopic(topicId: string) {
    this.selectedTopic = topicId;
    this.cdr.detectChanges();
  }

  toggleQuizSetMenu(setId: any, event: MouseEvent) {
    event.stopPropagation();
    this.activeQuizSetMenuId = this.activeQuizSetMenuId === setId ? null : setId;
    this.cdr.detectChanges();
  }

  closeQuizSetMenu() {
    this.activeQuizSetMenuId = null;
    this.cdr.detectChanges();
  }

  openQuizSetEditorFromMenu(quizSet: any) {
    this.closeQuizSetMenu();
    this.openQuizSetModal(quizSet);
  }

  openAssignModalFromMenu(quizSet: any) {
    this.closeQuizSetMenu();
    this.openAssignModal(quizSet);
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

  loadTopics() {
    this.http.get<any>('/api/topics').subscribe({
      next: (res: any) => {
        this.topics = res?.data || res || [];
        if (this.topics.length > 0) {
          this.questionForm.topicId = this.topics[0].id;
          this.quizSetForm.topicId = this.topics[0].id;
        }
        this.cdr.detectChanges();
      }
    });
  }

  loadQuestions() {
    this.http.get<any>('/api/questions').subscribe({
      next: (res: any) => {
        const rawData = res?.data || res || [];
        const dataArray = Array.isArray(rawData) ? rawData : [];
        
        this.questionsBank = dataArray.map((q: any) => {
          const rawOptions = q.options || q.Options || [];
          const cleanOptions = rawOptions.map((o: any) => o.content || o.Content || '');
          const correctIdx = rawOptions.findIndex((o: any) => o.isCorrect || o.IsCorrect);

          return {
            id: q.id || q.Id,
            text: q.content || q.Content || 'Nội dung câu hỏi trống',
            topicId: q.topicId || q.TopicId || '',
            level: q.level || q.Level || 'beginner',
            points: q.points ?? q.Points ?? 10,
            isActive: q.isActive ?? q.IsActive ?? true,
            options: cleanOptions,
            correctIndex: correctIdx > -1 ? correctIdx : 0,
            explanation: q.explanation || q.Explanation || ''
          };
        });
        this.cdr.detectChanges();
      },
      error: () => {
        this.cdr.detectChanges();
      }
    });
  }

loadQuizSets() {
    console.log('=== ADMIN: BẮT ĐẦU TẢI DANH SÁCH BỘ ĐỀ TỪ SERVICE ===');
    this.quizService.getAllQuizzes(true).subscribe({
      next: (res: any) => {
        console.log('=== ADMIN: DỮ LIỆU ĐÃ QUA MAP TỪ QUIZ.SERVICE ĐỔ VỀ COMPONENT ===', res);
        
        const dataArray = Array.isArray(res) ? res : [];
        
        this.quizSets = dataArray.map((s: any) => {
          console.log(`Bộ đề [${s.title}]: Thời gian gốc từ Service (duration) = ${s.duration} phút`);
          return {
            ...s,
            id: s.id,
            title: s.title || '',
            desc: s.desc || s.description || '',
            description: s.description || s.desc || '',
            topicId: s.topicId || '',
            level: s.level || 'beginner',
            duration: s.duration || 15,
            questionsCount: s.questionsCount ?? 0,
            statusClass: s.statusClass || 'public',
            status: s.status || 'Đã phát hành',
            questionIds: s.questionIds || []
          };
        });
        
        console.log('=== ADMIN: MẢNG QUIZSETS SAU KHI ĐỒNG BỘ PHÚT CHUẨN ===', this.quizSets);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('=== ADMIN: LỖI KHI GỌI API LAY DANH SACH BO DE ===', err);
      }
    });
  }

  openQuestionModal(question: any = null) {
    if (question) {
      this.isEditingQuestion = true;
      this.editingQuestionId = question.id;
      this.questionForm = {
        text: question.text || '',
        topicId: question.topicId || (this.topics[0]?.id || ''),
        level: question.level || 'beginner',
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
        topicId: this.topics[0]?.id || '',
        level: 'beginner',
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

    let mappedLevel = 'intermediate';
    const currentLevel = (this.questionForm.level || '').toString().trim().toLowerCase();
    if (currentLevel === 'dễ' || currentLevel === 'beginner') {
      mappedLevel = 'beginner';
    } else if (currentLevel === 'khó' || currentLevel === 'hard' || currentLevel === 'advanced') {
      mappedLevel = 'advanced';
    }

    const mappedOptions = this.questionForm.options.map((opt, idx) => ({
      content: opt.trim(),
      isCorrect: idx === this.questionForm.correctIndex,
      orderIndex: idx
    }));

    const questionPayload = {
      topicId: this.questionForm.topicId,
      content: this.questionForm.text.trim(),
      level: mappedLevel,
      explanation: this.questionForm.explanation.trim() || null,
      options: mappedOptions
    };

    const request$ = this.isEditingQuestion && this.editingQuestionId
      ? this.http.put<any>(`/api/questions/${this.editingQuestionId}`, questionPayload)
      : this.http.post<any>('/api/questions', questionPayload);

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
    this.quizService.toggleQuizStatus(set).subscribe({
      next: () => {
        this.loadQuizSets();
      },
      error: (err: any) => {
        console.error(err);
        alert('Không thể cập nhật trạng thái bộ đề lên Server!');
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
        topicId: quizSet.topicId || (this.topics[0]?.id || ''),
        level: quizSet.level || 'beginner',
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
        topicId: this.topics[0]?.id || '',
        level: 'beginner',
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
    this.assignSearchTerm = '';
    this.quizSetForm = {
      title: quizSet.title || '',
      desc: quizSet.desc || quizSet.description || '',
      description: quizSet.description || quizSet.desc || '',
      topicId: quizSet.topicId || '',
      level: quizSet.level || 'beginner',
      duration: quizSet.duration || 15,
      passRate: quizSet.passRate || 80,
      mode: quizSet.mode || 'practice',
      questionIds: quizSet.questionIds ? [...quizSet.questionIds] : []
    };
    this.loadQuizSetQuestionIds(quizSet.id);
    this.cdr.detectChanges();
  }

  loadQuizSetQuestionIds(quizSetId: any) {
    if (!quizSetId) {
      this.setSelectedQuizSetQuestionIds([]);
      return;
    }

    this.isLoadingAssignQuestions = true;
    this.http.get<any>(`/api/quiz-sets/${quizSetId}/questions`).subscribe({
      next: (res: any) => {
        const rawQuestions = res?.data || res || [];
        const questionIds = (Array.isArray(rawQuestions) ? rawQuestions : [])
          .map((q: any) => q.questionId || q.QuestionId || q.id || q.Id)
          .filter((id: any) => !!id);
        this.setSelectedQuizSetQuestionIds(questionIds);
      },
      error: () => {
        alert('Không thể tải danh sách câu hỏi đang có trong bộ đề.');
      },
      complete: () => {
        this.isLoadingAssignQuestions = false;
        this.cdr.detectChanges();
      }
    });
  }

  private setSelectedQuizSetQuestionIds(questionIds: any[]) {
    const uniqueIds = Array.from(new Set(questionIds));
    this.quizSetForm.questionIds = uniqueIds;

    if (this.selectedQuizSet) {
      this.selectedQuizSet.questionIds = [...uniqueIds];
      this.selectedQuizSet.questionsCount = uniqueIds.length;

      const index = this.quizSets.findIndex(set => set.id === this.selectedQuizSet.id);
      if (index > -1) {
        this.quizSets[index] = {
          ...this.quizSets[index],
          questionIds: [...uniqueIds],
          questionsCount: uniqueIds.length
        };
      }
    }
  }

  toggleQuestionInSet(qId: any) {
    if (!this.selectedQuizSet) return;
    
    const idx = this.quizSetForm.questionIds.indexOf(qId);
    if (idx > -1) {
      this.quizService.removeQuestionFromSet(this.selectedQuizSet.id, qId).subscribe({
        next: () => {
          this.setSelectedQuizSetQuestionIds(this.quizSetForm.questionIds.filter(id => id !== qId));
          this.cdr.detectChanges();
        },
        error: () => {
          alert('Không thể xóa câu hỏi khỏi bộ đề.');
          this.cdr.detectChanges();
        }
      });
    } else {
      this.quizService.assignQuestionToSet(this.selectedQuizSet.id, qId).subscribe({
        next: () => {
          this.setSelectedQuizSetQuestionIds([...this.quizSetForm.questionIds, qId]);
          this.cdr.detectChanges();
        },
        error: () => {
          alert('Không thể thêm câu hỏi vào bộ đề.');
          this.cdr.detectChanges();
        }
      });
    }
  }

  openQuestionEditorFromAssign(question: any, event: MouseEvent) {
    event.stopPropagation();
    this.openQuestionModal(question);
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

    let mappedLevel = 'intermediate';
    const currentLevel = (this.quizSetForm.level || '').toString().trim().toLowerCase();
    if (currentLevel === 'dễ' || currentLevel === 'beginner') {
      mappedLevel = 'beginner';
    } else if (currentLevel === 'khó' || currentLevel === 'hard' || currentLevel === 'advanced') {
      mappedLevel = 'advanced';
    }

    const payload = {
        title: this.quizSetForm.title.trim(),
        description: this.quizSetForm.desc || '',
        mode: this.quizSetForm.mode || 'practice',
        timeLimitSeconds: (this.quizSetForm.duration || 15) * 60, // Gửi số giây chuẩn xuống Backend
        isPublic: this.selectedQuizSet ? (this.selectedQuizSet.isPublic ?? true) : true,
        topicId: this.quizSetForm.topicId, 
        level: mappedLevel
    };

    console.log('=== ADMIN: PAYLOAD GỬI XUỐNG API UPDATE/CREATE ===', payload);
    const targetId = this.isEditingQuizSet && this.editingQuizSetId ? this.editingQuizSetId : '';
    
    this.quizService.saveQuizSetFromAdmin(targetId, payload).subscribe({
        next: (response) => {
            console.log('=== ADMIN: KẾT QUẢ PHẢN HỒI LƯU THÀNH CÔNG TỪ BACKEND ===', response);
            this.loadQuizSets();
            this.closeQuizSetModal();
            alert('Lưu thông số bộ đề thành công!');
        },
        error: (err: any) => {
            console.error('=== ADMIN: BACKEND TỪ CHỐI LƯU DỮ LIỆU ===', err);
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

  getTopicName(topicId: string): string {
    const t = this.topics.find(x => x.id === topicId);
    return t ? t.name : 'Chưa phân loại';
  }

  getLevelName(level: string): string {
    const formatLevel = (level || '').toLowerCase().trim();
    if (formatLevel === 'intermediate' || formatLevel === 'medium' || formatLevel === 'trung bình') return 'Trung bình';
    if (formatLevel === 'advanced' || formatLevel === 'hard' || formatLevel === 'khó') return 'Khó';
    return 'Dễ';
  }
}
