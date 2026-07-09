import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MobileMenuService } from '../../../core/services/mobile-menu.service';
import { QuizService } from '../../../core/services/quiz.service';
import { AnalyticsService, QuizSetAnalytics, QuizSetParticipant } from '../../../core/services/analytics.service';
import { CommonModule } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-quiz-management',
  standalone: true,
  imports: [FormsModule,  CommonModule],
  templateUrl: './quiz-management.html',
  styleUrl: './quiz-management.css'
})
export class QuizManagementComponent implements OnInit, OnDestroy {
  private quizService = inject(QuizService);
  private http = inject(HttpClient);
  private analytics = inject(AnalyticsService);
  private cdr = inject(ChangeDetectorRef);
  public mobileMenu = inject(MobileMenuService);

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
  isImportModalOpen: boolean = false;
  isDragging: boolean = false;
  fileSelected: boolean = false;
  fileName: string = '';
  fileSize: string = '';
  isImporting: boolean = false;
  importSummary = { total: 0, valid: 0, invalid: 0 };
  parsedQuestions: any[] = [];
  topicsMap: Record<string, string> = {};
  importDefaultTopicId: string = '';

  private readonly importTemplateJson = 'assets/templates/quiz-import-template.json';

  downloadImportTemplate(format: 'json' | 'xlsx') {
    if (format === 'xlsx') {
      const rows = [{ 'Nội dung câu hỏi': 'Ví dụ: HTML là gì?', 'Đáp án A': 'Ngôn ngữ đánh dấu', 'Đáp án B': 'Cơ sở dữ liệu', 'Đáp án C': 'Hệ điều hành', 'Đáp án D': 'Trình biên dịch', 'Đáp án đúng': 'A', 'Giải thích': 'HTML dùng để đánh dấu cấu trúc trang web.', 'Điểm số': 10 }];
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Questions');
      XLSX.writeFile(workbook, 'quiz-import-template.xlsx');
      return;
    }
    const href = this.importTemplateJson;
    const link = document.createElement('a');
    link.href = href;
    link.download = href.split('/').pop() || `quiz-import-template.${format}`;
    link.click();
  }

  quizSetForm = {
    title: '',
    desc: '',
    description: '',
    topicId: '',
    level: 'beginner',
    duration: 15,
    passRate: 80,
    mode: 'practice',
    questionIds: [] as any[],
    allowedCopy: false,
    isPublic: true
  };

  // Analytics stats
  quizAnalyticsMap: Record<string, QuizSetAnalytics> = {};
  isParticipantsModalOpen = false;
  participantsList: QuizSetParticipant[] = [];
  participantsQuizTitle = '';
  isLoadingParticipants = false;

  popupMessage = '';
  popupTitle = '';

  showPopup(title: string, message: string) {
    this.popupTitle = title;
    this.popupMessage = message;
    this.cdr.detectChanges();
  }

  closePopup() {
    this.popupMessage = '';
    this.cdr.detectChanges();
  }

  hasPermission(permission: string): boolean {
    if (!permission) return false;
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    if (!token) return false;
    try {
      const payloadPart = token.split('.')[1];
      const decoded = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')));
      
      // Admin role = full control
      const roleClaim = decoded['role'] || decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
      const roles = Array.isArray(roleClaim)
        ? roleClaim.map((r: string) => r.toLowerCase())
        : [(roleClaim || '').toLowerCase()];
      if (roles.includes('admin')) return true;

      // Check 'permission' claims
      const permClaim = decoded['permission'];
      const permList: string[] = Array.isArray(permClaim)
        ? permClaim
        : (permClaim ? [permClaim] : []);

      return permList.some(p => p.toLowerCase() === permission.toLowerCase()) ||
             permList.some(p => p.toLowerCase() === 'system.full_control');
    } catch (e) {
      return false;
    }
  }

  // Chuẩn hóa giá trị level: hỗ trợ cả tên cũ (medium/hard) lẫn tên mới từ API (intermediate/advanced)
  private normalizeLevel(level: string): string {
    if (!level) return 'beginner';
    const l = level.toLowerCase().trim();
    if (l === 'medium') return 'intermediate';
    if (l === 'hard') return 'advanced';
    return l;
  }

  get filteredQuestions() {
    const list = this.questionsBank || [];
    return list.filter(q => {
      const matchSearch = (q.text || '').toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchTopic = this.selectedTopic === 'all' || q.topicId === this.selectedTopic;
      const matchLevel = this.selectedLevel === 'all' || this.normalizeLevel(q.level) === this.selectedLevel;
      return matchSearch && matchTopic && matchLevel;
    });
  }

  get filteredQuizSets() {
    const list = this.quizSets || [];
    return list.filter(s => {
      const matchSearch = (s.title || '').toLowerCase().includes(this.searchTerm.toLowerCase()) ||
                          (s.description || '').toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchTopic = this.selectedTopic === 'all' || s.topicId === this.selectedTopic;
      const matchLevel = this.selectedLevel === 'all' || this.normalizeLevel(s.level) === this.selectedLevel;
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
    this.loadQuizAnalytics();
  }

  loadQuizAnalytics() {
    this.analytics.getQuizSetStats().subscribe({
      next: (stats) => {
        this.quizAnalyticsMap = {};
        for (const s of stats) {
          this.quizAnalyticsMap[s.quizSetId] = s;
        }
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Lỗi tải quiz analytics:', err)
    });
  }

  getQuizAnalytics(quizSetId: string): QuizSetAnalytics | null {
    return this.quizAnalyticsMap[quizSetId] ?? null;
  }

  openParticipantsModal(quizSetId: string, title: string) {
    this.participantsQuizTitle = title;
    this.isParticipantsModalOpen = true;
    this.isLoadingParticipants = true;
    this.participantsList = [];
    this.analytics.getQuizSetParticipants(quizSetId).subscribe({
      next: (list) => {
        this.participantsList = list;
        this.isLoadingParticipants = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoadingParticipants = false;
        this.cdr.detectChanges();
      }
    });
  }

  closeParticipantsModal() {
    this.isParticipantsModalOpen = false;
    this.participantsList = [];
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
        const rawData = res?.data || [];
        this.questionsBank = rawData.map((q: any) => ({
          id: q.id,
          text: q.content || 'Nội dung trống', // Map content -> text
          topicId: q.topicId,
          level: q.level || 'beginner',
          points: 10,
          isActive: q.isActive ?? true, // Lấy từ API
          options: q.options ? q.options.map((o: any) => o.content) : [],
          correctIndex: q.options ? q.options.findIndex((o: any) => o.isCorrect) : 0,
          explanation: q.explanation || ''
        }));
        this.cdr.detectChanges();
      }
    });
  }

loadQuizSets() {
    this.http.get<any>('/api/quiz-sets', { params: { includePrivate: true, manageMode: true } }).subscribe({
      next: (res: any) => {
        const rawSets = res?.data || [];
        this.quizSets = rawSets.map((s: any) => ({
          id: s.id,
          createdBy: s.createdBy || s.CreatedBy || '',
          title: s.title,
          desc: s.description || '',
          topicId: s.topicId,
          level: s.level || 'beginner',
          duration: Math.floor((s.timeLimitSeconds || 0) / 60),
          questionsCount: s.questionCount || 0,
          statusClass: s.isPublic ? 'public' : 'draft',
          status: s.isPublic ? 'Đã phát hành' : 'Bản nháp',
          isPublic: s.isPublic,
          allowedCopy: s.allowedCopy ?? false,
          reviewStatus: s.reviewStatus || ''
        }));
        this.cdr.detectChanges();
      }
    });
  }

  openQuestionModal(question: any = null) {
    const requiredPermission = question ? 'quiz:edit' : 'quiz:create';
    if (!this.hasPermission(requiredPermission) && !this.hasPermission('quiz:edit')) {
      this.showPopup('Từ chối truy cập', 'Bạn không có quyền thêm mới hoặc chỉnh sửa câu hỏi trắc nghiệm!');
      return;
    }

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
    const content = this.questionForm.text.trim();
    const normalizedLevel = this.normalizeLevel(this.questionForm.level);
    const options = this.questionForm.options.map(opt => (opt || '').trim());

    if (!this.questionForm.topicId) {
      alert('Vui lòng chọn chủ đề cho câu hỏi.');
      return;
    }

    if (!content) {
      alert('Vui lòng nhập nội dung câu hỏi.');
      return;
    }

    if (options.some(opt => !opt)) {
      alert('Vui lòng nhập đầy đủ tất cả phương án trả lời.');
      return;
    }

    if (this.questionForm.correctIndex < 0 || this.questionForm.correctIndex >= options.length) {
      alert('Vui lòng chọn đáp án đúng hợp lệ.');
      return;
    }

    const payload = {
      topicId: this.questionForm.topicId,
      content,
      level: normalizedLevel,
      points: this.questionForm.points,
      explanation: this.questionForm.explanation?.trim() || '',
      isActive: true,
      options: options.map((opt, idx) => ({
        content: opt,
        isCorrect: idx === this.questionForm.correctIndex,
        orderIndex: idx
      }))
    };

    const req = this.isEditingQuestion
      ? this.http.put(`/api/questions/${this.editingQuestionId}`, payload)
      : this.http.post('/api/questions', payload);

    req.subscribe({
      next: () => {
        this.loadQuestions();
        this.closeQuestionModal();
      },
      error: (err) => {
        console.error('Lỗi lưu câu hỏi:', err, payload);
        alert(err.error?.message || err.error?.title || 'Không lưu được câu hỏi. Kiểm tra lại dữ liệu và thử lại.');
      }
    });
  }

toggleQuestionStatus(q: any) {
    const payload = {
      topicId: q.topicId,
      content: q.text,
      level: q.level,
      explanation: q.explanation,
      isActive: !q.isActive, // Đảo trạng thái
      options: q.options.map((o: string, idx: number) => ({
        content: o,
        isCorrect: idx === q.correctIndex,
        orderIndex: idx
      }))
    };

    this.http.put(`/api/questions/${q.id}`, payload).subscribe({
      next: () => {
        q.isActive = !q.isActive;
        this.cdr.detectChanges();
      }
    });
  }

toggleQuizSetStatus(set: any) {
    const payload = {
      title: set.title,
      description: set.desc,
      mode: 'practice',
      timeLimitSeconds: set.duration * 60,
      isPublic: !set.isPublic,
      topicId: set.topicId,
      level: set.level
    };

    this.http.put(`/api/quiz-sets/${set.id}`, payload).subscribe({
      next: () => {
        this.loadQuizSets();
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
    const requiredPermission = quizSet ? 'quiz:edit' : 'quiz:create';
    if (!this.hasPermission(requiredPermission) && !this.hasPermission('quiz:edit')) {
      this.showPopup('Từ chối truy cập', 'Bạn không có quyền tạo mới hoặc chỉnh sửa bộ đề thi!');
      return;
    }

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
        questionIds: quizSet.questionIds ? [...quizSet.questionIds] : [],
        allowedCopy: quizSet.allowedCopy ?? false,
        isPublic: quizSet.isPublic ?? true
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
        questionIds: [],
        allowedCopy: false,
        isPublic: true
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
      questionIds: quizSet.questionIds ? [...quizSet.questionIds] : [],
      allowedCopy: quizSet.allowedCopy ?? false,
      isPublic: quizSet.isPublic ?? true
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

    const finalDescription = this.quizSetForm.desc || this.quizSetForm.description || '';

    let mappedLevel = 'intermediate';
    const currentLevel = (this.quizSetForm.level || '').toString().trim().toLowerCase();
    if (currentLevel === 'dễ' || currentLevel === 'beginner') {
      mappedLevel = 'beginner';
    } else if (currentLevel === 'khó' || currentLevel === 'hard' || currentLevel === 'advanced') {
      mappedLevel = 'advanced';
    }

    const payload = {
        title: this.quizSetForm.title.trim(),
        description: finalDescription,
        mode: this.quizSetForm.mode || 'practice',
        timeLimitSeconds: (this.quizSetForm.duration || 15) * 60, // Gửi số giây chuẩn xuống Backend
        isPublic: this.quizSetForm.isPublic ?? true,
        topicId: this.quizSetForm.topicId,
        level: mappedLevel,
        allowedCopy: this.quizSetForm.allowedCopy ?? false
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
    if (confirm('Xác nhận xóa bộ đề thi này khỏi hệ thống phân phối? Nếu bộ đề đã có người làm bài, hệ thống sẽ tự động lưu trữ (ẩn) thay vì xóa vĩnh viễn để không làm mất lịch sử làm bài.')) {
      this.quizService.deleteQuizSet(id).subscribe({
        next: (res: any) => {
          this.loadQuizSets();
          // BE trả archived:true khi bộ đề đã có người làm bài — nó được ẩn/lưu trữ thay
          // vì xóa cứng, để giữ nguyên lịch sử QuizSession/QuizAnswer liên quan.
          if (res?.data?.archived) {
            alert('Bộ đề đã có người làm bài nên được lưu trữ (ẩn khỏi danh sách) thay vì xóa vĩnh viễn.');
          } else {
            alert('Đã xóa bộ đề thi thành công!');
          }
        },
        error: (err: any) => {
          // Không được tự ý xóa khỏi danh sách ở đây: nếu BE từ chối thật sự mà vẫn xóa
          // khỏi UI thì admin tưởng đã xóa xong, đến khi tải lại trang bộ đề "tái xuất
          // hiện" vì thực ra chưa hề bị xóa/lưu trữ dưới DB.
          console.error('Lỗi xóa bộ đề:', err);
          alert(err?.error?.message || 'Không thể xóa bộ đề thi.');
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

  openImportModal() {
    this.isImportModalOpen = true;
    this.importDefaultTopicId = this.topics[0]?.id || '';
    this.loadTopicsForImport();
  }

  closeImportModal() {
    this.isImportModalOpen = false;
    this.clearImportFile();
  }

  loadTopicsForImport() {
    this.http.get<any>('/api/topics').subscribe({
      next: (res) => {
        const topics: any[] = res?.data || res || [];
        if (Array.isArray(topics)) {
          this.topicsMap = {};
          topics.forEach((t: any) => {
            if (t.id) this.topicsMap[t.id.toLowerCase()] = t.name || t.id;
          });
        }
        // Tự động chọn topic đầu tiên nếu chưa có
        if (!this.importDefaultTopicId && topics.length > 0) {
          this.importDefaultTopicId = topics[0].id;
        }
        if (this.parsedQuestions.length > 0) {
          this.parsedQuestions = this.parsedQuestions.map(q => ({
            ...q,
            topicName: this.topicsMap[q.topicId?.toLowerCase()] || q.topicId || '---'
          }));
          this.cdr.detectChanges();
        }
      }
    });
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave() {
    this.isDragging = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFileProcessing(files[0]);
    }
  }

  onFileSelected(event: any) {
    const files = event.target.files;
    if (files && files.length > 0) {
      this.handleFileProcessing(files[0]);
    }
    event.target.value = '';
  }

  handleFileProcessing(file: File) {
    this.fileSelected = true;
    this.fileName = file.name;
    this.fileSize = (file.size / 1024).toFixed(1) + ' KB';
    // Hiện ngay drag-drop zone với tên file, trước khi đọc xong
    this.cdr.detectChanges();

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const reader = new FileReader();

    reader.onload = (e: any) => {
      try {
        if (fileExtension === 'json') {
          const rawData = JSON.parse(e.target.result);
          this.processJsonData(rawData);
        } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
          this.processExcelData(json);
        }
      } catch (err) {
        alert('Lỗi định dạng tệp: ' + err);
        this.clearImportFile();
      }
    };

    if (fileExtension === 'json') reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
  }

  private readonly contentAliases = ['nội dung câu hỏi', 'nội dung', 'câu hỏi', 'content', 'text', 'question'];
  private readonly topicAliases = ['topicid', 'topic id', 'topic_id', 'topic', 'chủ đề', 'mã chủ đề', 'mã topic'];
  private readonly levelAliases = ['level', 'cấp độ', 'mức độ', 'khó dễ', 'difficulty'];
  private readonly explanationAliases = ['giải thích', 'giải thích chi tiết', 'explanation', 'explain'];
  private readonly optionAAliases = ['a', 'đáp án a', 'option a', 'lựa chọn a', 'optiona'];
  private readonly optionBAliases = ['b', 'đáp án b', 'option b', 'lựa chọn b', 'optionb'];
  private readonly optionCAliases = ['c', 'đáp án c', 'option c', 'lựa chọn c', 'optionc'];
  private readonly optionDAliases = ['d', 'đáp án d', 'option d', 'lựa chọn d', 'optiond'];
  private readonly correctAliases = ['đáp án đúng', 'đáp án', 'correct', 'correctanswer', 'correct answer', 'correct index', 'correctindex'];

  private getValueByAliases(row: any, aliases: string[]): any {
    if (!row || typeof row !== 'object') return undefined;
    const keys = Object.keys(row);
    for (const alias of aliases) {
      const cleanAlias = alias.trim().toLowerCase().normalize('NFC');
      const foundKey = keys.find(k => k.trim().toLowerCase().normalize('NFC') === cleanAlias);
      if (foundKey !== undefined) {
        return row[foundKey];
      }
    }
    return undefined;
  }

  private getCorrectAnswerIndex(correctVal: any): number {
    const ans = String(correctVal || '').trim().toUpperCase();
    if (ans === 'A') return 0;
    if (ans === 'B') return 1;
    if (ans === 'C') return 2;
    if (ans === 'D') return 3;
    if (ans === '0') return 0;
    if (ans === '1') return 0;
    if (ans === '2') return 1;
    if (ans === '3') return 2;
    if (ans === '4') return 3;
    return -1;
  }

  private processJsonData(data: any) {
    const arr = Array.isArray(data) ? data : (data.questions || [data]);
    this.parsedQuestions = arr.map((q: any, idx: number) => this.validateAndMapImport(q, idx));
    this.calculateImportSummary();
  }

  private processExcelData(json: any[]) {
    this.parsedQuestions = json.map((row, idx) => {
      const content = this.getValueByAliases(row, this.contentAliases);
      const topicId = this.getValueByAliases(row, this.topicAliases);
      const level = this.getValueByAliases(row, this.levelAliases);
      const explanation = this.getValueByAliases(row, this.explanationAliases);
      const correctVal = this.getValueByAliases(row, this.correctAliases);

      const optionA = this.getValueByAliases(row, this.optionAAliases);
      const optionB = this.getValueByAliases(row, this.optionBAliases);
      const optionC = this.getValueByAliases(row, this.optionCAliases);
      const optionD = this.getValueByAliases(row, this.optionDAliases);

      const correctIndex = this.getCorrectAnswerIndex(correctVal);

      const rawOptions = [
        { content: optionA, isCorrect: correctIndex === 0 },
        { content: optionB, isCorrect: correctIndex === 1 },
        { content: optionC, isCorrect: correctIndex === 2 },
        { content: optionD, isCorrect: correctIndex === 3 }
      ];

      const options = rawOptions
        .filter(opt => opt.content !== undefined && opt.content !== null && String(opt.content).trim() !== '')
        .map(opt => ({
          content: String(opt.content).trim(),
          isCorrect: opt.isCorrect
        }));

      const q = {
        content: content ? String(content).trim() : '',
        topicId: topicId ? String(topicId).trim() : '',
        level: level ? String(level).trim().toLowerCase() : 'beginner',
        explanation: explanation ? String(explanation).trim() : '',
        options: options
      };

      return this.validateAndMapImport(q, idx);
    });
    this.calculateImportSummary();
  }

  private validateAndMapImport(q: any, index: number) {
    const options = q.options || [];
    const textContent = q.content || q.text || '';
    // Nếu câu hỏi không có topicId trong file, dùng topic mặc định đã chọn
    const topicIdentifier = ((q.topicId || '').trim()) || this.importDefaultTopicId || '';

    // Xử lý options dạng mảng string (từ file JSON template) hoặc mảng object
    let parsedOptions = options;
    if (options.length > 0 && typeof options[0] === 'string') {
      // Dạng ["Option A", "Option B", ...] + correctIndex
      const correctIndex = q.correctIndex ?? 0;
      parsedOptions = options.map((opt: string, idx: number) => ({
        content: opt,
        isCorrect: idx === correctIndex
      }));
    }

    const hasText = typeof textContent === 'string' && !!textContent.trim();
    const hasTopic = !!topicIdentifier;
    const hasOptions = parsedOptions.length >= 2;

    const isValid = hasText && hasTopic && hasOptions;

    let errorMsg = '';
    if (!hasText) errorMsg = 'Nội dung câu hỏi không được để trống.';
    else if (!hasTopic) errorMsg = 'Vui lòng chọn chủ đề mặc định ở phía trên.';
    else if (!hasOptions) errorMsg = 'Danh sách đáp án lựa chọn phải từ 2 mục trở lên.';

    const topicName = this.topicsMap[topicIdentifier.toLowerCase()] || topicIdentifier || '---';

    return {
      rowNum: index + 1,
      text: textContent,
      topic: topicIdentifier,
      topicName: topicName,
      topicId: topicIdentifier,
      _originalTopicId: (q.topicId || '').trim(), // Lưu topicId gốc từ file (có thể rỗng)
      level: q.level || 'beginner',
      explanation: q.explanation || '',
      optionsCount: parsedOptions.length,
      options: parsedOptions,
      isValid: isValid,
      errorMsg: errorMsg
    };
  }

  private calculateImportSummary() {
    this.importSummary = {
      total: this.parsedQuestions.length,
      valid: this.parsedQuestions.filter(q => q.isValid).length,
      invalid: this.parsedQuestions.filter(q => !q.isValid).length
    };
    this.cdr.detectChanges();
  }

  clearImportFile() {
    this.fileSelected = false;
    this.fileName = '';
    this.fileSize = '';
    this.parsedQuestions = [];
    this.importSummary = { total: 0, valid: 0, invalid: 0 };
    this.cdr.detectChanges();
  }

  onImportTopicChange() {
    // Khi đổi topic mặc định, re-validate toàn bộ danh sách
    if (this.parsedQuestions.length > 0) {
      this.parsedQuestions = this.parsedQuestions.map((q, idx) => {
        // Chỉ re-validate những câu hỏi đang thiếu topicId gốc
        const originalTopicId = (q._originalTopicId ?? q.topicId ?? '');
        const effectiveTopicId = originalTopicId || this.importDefaultTopicId || '';
        const topicName = this.topicsMap[effectiveTopicId.toLowerCase()] || effectiveTopicId || '---';
        const hasText = !!q.text?.trim();
        const hasTopic = !!effectiveTopicId;
        const hasOptions = q.options?.length >= 2;
        const isValid = hasText && hasTopic && hasOptions;
        let errorMsg = '';
        if (!hasText) errorMsg = 'Nội dung câu hỏi không được để trống.';
        else if (!hasTopic) errorMsg = 'Vui lòng chọn chủ đề mặc định ở phía trên.';
        else if (!hasOptions) errorMsg = 'Danh sách đáp án lựa chọn phải từ 2 mục trở lên.';
        return { ...q, topicId: effectiveTopicId, topicName, isValid, errorMsg };
      });
      this.calculateImportSummary();
    }
  }

  executeImport() {
    if (this.isImporting) return;

    const payload = this.parsedQuestions
      .filter(q => q.isValid)
      .map(q => {
        let mappedLevel = 'beginner';
        const rawLevel = (q.level || '').toString().trim().toLowerCase();

        if (rawLevel === 'dễ' || rawLevel === 'beginner') {
          mappedLevel = 'beginner';
        } else if (rawLevel === 'trung bình' || rawLevel === 'medium' || rawLevel === 'intermediate') {
          mappedLevel = 'intermediate';
        } else if (rawLevel === 'khó' || rawLevel === 'hard' || rawLevel === 'advanced') {
          mappedLevel = 'advanced';
        }

        return {
          topicId: q.topicId,
          content: q.text,
          level: mappedLevel,
          explanation: q.explanation || null,
          isActive: true,
          options: q.options.map((opt: any, idx: number) => ({
            content: String(opt.content || '').trim(),
            isCorrect: !!opt.isCorrect,
            orderIndex: idx
          }))
        };
      });

    if (payload.length === 0) {
      alert('Không tìm thấy câu hỏi hợp lệ để nạp!');
      return;
    }

    this.isImporting = true;

    this.quizService.importQuestions(payload).subscribe({
      next: (res: any) => {
        // Lấy danh sách ID câu hỏi vừa được tạo từ backend
        const importedIds = res?.createdQuestionIds || res?.CreatedQuestionIds || [];

        if (this.isAssignModalOpen && this.selectedQuizSet && importedIds.length > 0) {
          const assignReqs = importedIds.map((id: any) =>
            this.quizService.assignQuestionToSet(this.selectedQuizSet.id, id).pipe(
              catchError(err => of(null))
            )
          );

          forkJoin(assignReqs).subscribe(() => {
            this.isImporting = false;
            alert(`Đã nạp và gán thành công ${importedIds.length} câu hỏi vào bộ đề!`);
            this.clearImportFile();
            this.closeImportModal();
            this.loadQuestions();
            this.loadQuizSetQuestionIds(this.selectedQuizSet.id);
          });
        } else {
          this.isImporting = false;
          alert(`Đã nạp thành công ${payload.length} câu hỏi vào hệ thống!`);
          this.clearImportFile();
          this.closeImportModal();
          this.loadQuestions();
        }
      },
      error: (err) => {
        this.isImporting = false;
        console.error('Lỗi chi tiết từ API Backend:', err);

        if (err.error && err.error.errors) {
          const firstErrorKey = Object.keys(err.error.errors)[0];
          const firstErrorMsg = err.error.errors[firstErrorKey][0];
          alert(`Nạp thất bại! Lỗi tại trường [${firstErrorKey}]: ${firstErrorMsg}`);
        } else {
          alert(`Lỗi nạp dữ liệu: ${err.error?.message || 'Server từ chối dữ liệu.'}`);
        }
      }
    });
  }
}
