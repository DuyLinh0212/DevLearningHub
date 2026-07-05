import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { QuizService } from '../../../core/services/quiz.service';
import { TopicService } from '../../../core/services/topic.service';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-quiz-create',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './quiz-create.html',
  styleUrl: './quiz-create.css'
})
export class QuizCreateComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private quizService = inject(QuizService);
  private topicService = inject(TopicService);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private readonly importTemplateCsv = 'assets/templates/quiz-import-template.csv';
  private readonly importTemplateJson = 'assets/templates/quiz-import-template.json';

  currentStep: number = 1;
  activeQuestionIndex: number = 0;
  isPreviewModalOpen: boolean = false;
  editingQuizId: string | null = null;
  isSaving: boolean = false;
  saveError: string = '';
  importFeedback: string = '';
  importError: string = '';
  isImportModalOpen: boolean = false;
  isImportDragActive: boolean = false;
  selectedImportFileName: string = '';
  topics: any[] = [];
  
  private readonly defaultTopicNames = [
    'Lập trình Backend',
    'Lập trình Frontend',
    'Cơ sở dữ liệu',
    'Kiểm thử phần mềm',
    'An toàn thông tin'
  ];

  quizMeta = {
    title: '',
    desc: '',
    topicId: '',
    level: 'medium',
    duration: 15,
    passRate: 70,
    shuffle: true,
    instantResult: true,
    allowedCopy: true,
    examUseAllQuestions: true,
    examQuestionCount: 10
  };

  questions: any[] = [this.createEmptyQuestion()];

  ngOnInit() {
    const hasToken = typeof window !== 'undefined' && Boolean(localStorage.getItem('accessToken') || localStorage.getItem('token'));
    if (!hasToken) {
      alert('Vui lòng đăng nhập để tạo đề thi!');
      this.router.navigate(['/login']);
      return;
    }

    this.http.get<any>('/api/users/me').subscribe({
      next: (res) => {
        const user = res?.data || res;
        const perms = (user.permissions || []).map((p: string) => (p || '').toLowerCase());
        const hasPermission = perms.includes('quiz:create') || perms.includes('quiz:edit') || perms.includes('system.full_control');
        
        if (!hasPermission) {
          alert('Bạn không có quyền tạo bộ đề thi!');
          this.router.navigate(['/quiz-bank']);
          return;
        }

        // Proceed with loading topics and editing values
        this.loadTopics();

        this.route.queryParams.subscribe(params => {
          if (!params['id']) {
            return;
          }

          this.editingQuizId = params['id'];
          console.log(`=== ADMIN_CREATE: TIẾN HÀNH TẢI DỮ LIỆU ĐỀ CŨ ĐỂ SỬA, ID: ${this.editingQuizId} ===`);
          
          this.quizService.getQuiz(this.editingQuizId!).subscribe({
            next: (res: any) => {
              const target = res?.data || res;
              if (!target) return;

              console.log('=== DỮ LIỆU BỘ ĐỀ CHI TIẾT ĐỂ EDIT TỪ API ===', target);
              const rawMode = target.mode || '';
              
              const dbLevel = (target.level || 'intermediate').toString().toLowerCase().trim();
              let uiLevel = 'medium';
              if (dbLevel === 'beginner') {
                uiLevel = 'beginner';
              } else if (dbLevel === 'advanced' || dbLevel === 'hard') {
                uiLevel = 'hard';
              } else {
                uiLevel = 'medium'; 
              }

              const examQuestionCount = target.examQuestionCount ?? target.ExamQuestionCount ?? null;

              this.quizMeta = {
                title: target.title || '',
                desc: target.description || target.desc || '',
                topicId: target.topicId || this.quizMeta.topicId || this.topics[0]?.id || '',
                level: uiLevel,
                duration: target.timeLimitSeconds ? Math.floor(target.timeLimitSeconds / 60) : 15,
                passRate: target.passRate || 70,
                shuffle: rawMode.includes('shuf:T') || !rawMode.includes('shuf:F'),
                instantResult: rawMode.includes('inst:T') || !rawMode.includes('inst:F'),
                allowedCopy: target.allowedCopy ?? target.AllowedCopy ?? true,
                examUseAllQuestions: !examQuestionCount,
                examQuestionCount: examQuestionCount || 10
              };

              const rawQuestions = target.questions || [];
              if (rawQuestions.length > 0) {
                this.questions = rawQuestions.map((question: any) => ({
                  id: question.id,
                  points: question.points || 10,
                  type: question.type || 'single',
                  text: question.text || question.content || '',
                  options: [...(question.options || [])],
                  correctIndex: question.correctIndex ?? 0,
                  explanation: question.explanation || ''
                }));
              }
              this.cdr.detectChanges();
            },
            error: (err: any) => {
              this.saveError = this.getApiError(err);
            }
          });
        });
      },
      error: () => {
        alert('Không thể xác thực quyền truy cập.');
        this.router.navigate(['/quiz-bank']);
      }
    });
  }

  nextStep() {
    if (this.quizMeta.title.trim()) {
      this.saveError = '';
      this.currentStep = 2;
      return;
    }
    this.saveError = 'Vui lòng nhập tiêu đề bộ đề.';
  }

  prevStep() { this.currentStep = 1; }
  
  addQuestion() { 
    this.questions.push(this.createEmptyQuestion()); 
    this.activeQuestionIndex = this.questions.length - 1;
    this.cdr.detectChanges();
  }

  selectQuestion(index: number) {
    this.activeQuestionIndex = index;
    this.cdr.detectChanges();
  }

  deleteQuestion(index: number) {
    if (this.questions.length > 1) {
      this.questions.splice(index, 1);
      if (this.activeQuestionIndex >= this.questions.length) {
        this.activeQuestionIndex = this.questions.length - 1;
      }
    } else {
      this.questions = [this.createEmptyQuestion()];
      this.activeQuestionIndex = 0;
    }
    this.cdr.detectChanges();
  }

  removeQuestion(index: number) { 
    this.deleteQuestion(index); 
  }

  setCorrectAnswer(questionIndex: number, optionIndex: number) { 
    this.questions[questionIndex].correctIndex = optionIndex; 
    this.cdr.detectChanges();
  }

  onQuestionFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    this.selectedImportFileName = '';
    this.importFeedback = '';
    this.importError = '';
    if (!file) return;

    this.selectedImportFileName = file.name;

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.json') && !fileName.endsWith('.xlsx') && !fileName.endsWith('.xls') && !fileName.endsWith('.csv')) {
      this.importError = 'Hệ thống chỉ hỗ trợ định dạng tệp .json, .xlsx, .xls hoặc .csv';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.importError = 'Kích thước tệp tin không được vượt quá 5MB.';
      return;
    }

    const reader = new FileReader();
    if (fileName.endsWith('.json')) {
      reader.onload = () => {
        try {
          const rawData = JSON.parse(String(reader.result));
          const rows = Array.isArray(rawData) ? rawData : (Array.isArray(rawData?.questions) ? rawData.questions : [rawData]);
          const importedQuestions = rows
            .map((row: any) => this.mapImportedQuestion(row))
            .filter((question: any) => this.isQuestionValid(question));
          if (importedQuestions.length === 0) {
            this.importError = 'Không tìm thấy câu hỏi hợp lệ trong tệp JSON.';
            this.cdr.detectChanges();
            return;
          }
          if (this.questions.length === 1 && this.isBlankQuestion(this.questions[0])) { this.questions = []; }
          this.questions.push(...importedQuestions);
          this.importFeedback = `Đã thêm thành công ${importedQuestions.length} câu hỏi từ tệp JSON.`;
          this.cdr.detectChanges();
        } catch {
          this.importError = 'Tệp JSON không hợp lệ hoặc sai cấu trúc.';
          this.cdr.detectChanges();
        }
      };
      reader.readAsText(file);
    } else if (fileName.endsWith('.csv')) {
      reader.onload = () => {
        try {
          const csvText = String(reader.result || '');
          const workbook = XLSX.read(csvText, { type: 'string' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

          this.applySpreadsheetRows(rawRows, 'csv');
        } catch {
          this.importError = 'Tệp CSV bị lỗi cấu trúc hoặc không thể bóc tách.';
          this.cdr.detectChanges();
        }
      };
      reader.readAsText(file, 'utf-8');
    } else {
      reader.onload = (e: any) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
          this.applySpreadsheetRows(rawRows, 'excel');
        } catch {
          this.importError = 'Tệp Excel bị lỗi cấu trúc hoặc không thể bóc tách.';
          this.cdr.detectChanges();
        }
      };
      reader.readAsArrayBuffer(file);
    }
  }

  openImportModal() {
    this.isImportModalOpen = true;
    this.isImportDragActive = false;
    this.importError = '';
  }

  closeImportModal() {
    this.isImportModalOpen = false;
    this.isImportDragActive = false;
  }

  onImportDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isImportDragActive = true;
  }

  onImportDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isImportDragActive = false;
  }

  onImportDrop(event: DragEvent, input: HTMLInputElement) {
    event.preventDefault();
    event.stopPropagation();
    this.isImportDragActive = false;

    const file = event.dataTransfer?.files?.[0];
    if (!file) return;

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    input.files = dataTransfer.files;
    this.onQuestionFileSelected({ target: input } as unknown as Event);
  }

  downloadImportTemplate(format: 'csv' | 'json' | 'xlsx') {
    if (format === 'xlsx') {
      const rows = [{ 'Nội dung câu hỏi': 'Ví dụ: HTML là gì?', 'Đáp án A': 'Ngôn ngữ đánh dấu', 'Đáp án B': 'Cơ sở dữ liệu', 'Đáp án C': 'Hệ điều hành', 'Đáp án D': 'Trình biên dịch', 'Đáp án đúng': 'A', 'Giải thích': 'HTML dùng để đánh dấu cấu trúc trang web.', 'Điểm số': 10 }];
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Questions');
      XLSX.writeFile(workbook, 'quiz-import-template.xlsx');
      return;
    }
    const href = format === 'csv' ? this.importTemplateCsv : this.importTemplateJson;
    const link = document.createElement('a');
    link.href = href;
    link.download = href.split('/').pop() || `quiz-import-template.${format}`;
    link.click();
  }

  openPreview() {
    if (!this.quizMeta.title.trim()) {
      this.saveError = 'Vui lòng nhập tiêu đề bộ đề.';
      return;
    }
    if (this.currentStep === 2) {
      const validationError = this.getPublishValidationError();
      if (validationError) {
        this.saveError = validationError;
        return;
      }
    }
    this.saveError = '';
    this.isPreviewModalOpen = true;
  }

  closePreview() { this.isPreviewModalOpen = false; }

  saveDraft() {
    if (!this.quizMeta.title.trim()) {
      this.saveError = 'Vui lòng nhập tiêu đề bộ đề.';
      return;
    }
    const validQuestions = this.questions.filter(question => this.isQuestionValid(question));
    if (validQuestions.length > 0 && !this.quizMeta.topicId) {
      this.saveError = 'Vui lòng chọn chủ đề trước khi lưu câu hỏi.';
      return;
    }
    this.persistQuiz(validQuestions, true);
  }

  completeQuiz() {
    const validationError = this.getPublishValidationError();
    if (validationError) {
      this.saveError = validationError;
      this.isPreviewModalOpen = false;
      return;
    }
    this.persistQuiz(this.questions, false);
  }

  private loadTopics() {
    this.topicService.getAllTopics().subscribe({
      next: (topics: any[]) => {
        this.topics = topics.length > 0
          ? topics
          : this.defaultTopicNames.map((name, idx) => ({ id: 'mock-id-' + idx, name }));
        
        if (!this.quizMeta.topicId && this.topics.length > 0) {
          this.quizMeta.topicId = this.topics[0].id || '';
        }
        this.cdr.detectChanges();
      },
      error: (err: any) => { this.saveError = this.getApiError(err); }
    });
  }

  private createEmptyQuestion() {
    return { points: 10, type: 'single', text: '', options: ['', '', '', ''], correctIndex: 0, explanation: '' };
  }

  private mapImportedQuestion(row: any) {
    const rawOptions = Array.isArray(row?.options ?? row?.Options) ? row.options ?? row.Options : [];
    const options = rawOptions.map((option: any) => typeof option === 'string' ? option : option?.content ?? option?.Content ?? '');
    const optionCorrectIndex = rawOptions.findIndex((option: any) => typeof option === 'object' && Boolean(option?.isCorrect ?? option?.IsCorrect));
    const rawCorrectIndex = row?.correctIndex ?? row?.CorrectIndex;
    const correctIndex = Number.isInteger(rawCorrectIndex) ? Number(rawCorrectIndex) : optionCorrectIndex;

    return {
      points: row?.points ?? row?.Points ?? 10,
      type: 'single',
      text: row?.text ?? row?.Text ?? row?.content ?? row?.Content ?? '',
      options,
      correctIndex,
      explanation: row?.explanation ?? row?.Explanation ?? '',
      level: row?.level ?? row?.Level ?? this.quizMeta.level
    };
  }

  private applySpreadsheetRows(rawRows: any[], source: 'csv' | 'excel') {
    const importedQuestions = rawRows
      .map((row: any) => {
        const options = [
          this.readCell(row, ['Đáp án A', 'OptionA', 'A']),
          this.readCell(row, ['Đáp án B', 'OptionB', 'B']),
          this.readCell(row, ['Đáp án C', 'OptionC', 'C']),
          this.readCell(row, ['Đáp án D', 'OptionD', 'D'])
        ];

        let correctIdx = 0;
        const ans = this.readCell(row, ['Đáp án đúng', 'CorrectAnswer', 'Answer']).trim().toUpperCase();
        if (ans === 'B' || ans === '1' || ans === '2') correctIdx = 1;
        else if (ans === 'C' || ans === '2' || ans === '3') correctIdx = 2;
        else if (ans === 'D' || ans === '3' || ans === '4') correctIdx = 3;

        return {
          points: Number(this.readCell(row, ['Điểm số', 'Points', 'Score']) || 10),
          type: 'single',
          text: this.readCell(row, ['Nội dung câu hỏi', 'Content', 'Text', 'Question']).trim(),
          options,
          correctIndex: correctIdx,
          explanation: this.readCell(row, ['Giải thích', 'Explanation', 'Hint']).trim()
        };
      })
      .filter((q: any) => this.isQuestionValid(q));

    if (importedQuestions.length === 0) {
      this.importError = source === 'csv'
        ? 'Không tìm thấy dữ liệu hàng câu hỏi hợp lệ trong tệp CSV.'
        : 'Không tìm thấy dữ liệu hàng câu hỏi hợp lệ trong bảng tính Excel.';
      this.cdr.detectChanges();
      return;
    }

    if (this.questions.length === 1 && this.isBlankQuestion(this.questions[0])) {
      this.questions = [];
    }

    this.questions.push(...importedQuestions);
    this.importFeedback = source === 'csv'
      ? `Đã nạp thành công ${importedQuestions.length} câu hỏi từ tệp CSV.`
      : `Đã nạp thành công ${importedQuestions.length} câu hỏi từ bảng tính Excel.`;
    this.cdr.detectChanges();
  }

  private readCell(row: any, keys: string[]): string {
    for (const key of keys) {
      const value = row?.[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value).trim();
      }
    }
    return '';
  }

  private isBlankQuestion(question: any) {
    return !String(question?.text || '').trim() && (question?.options || []).every((option: any) => !String(option || '').trim());
  }

  private isQuestionValid(question: any) {
    const options = Array.isArray(question?.options) ? question.options : [];
    return Boolean(String(question?.text || '').trim()) &&
      options.length >= 2 &&
      options.every((option: any) => Boolean(String(option || '').trim())) &&
      Number.isInteger(question?.correctIndex) &&
      question.correctIndex >= 0 &&
      question.correctIndex < options.length;
  }

  private getPublishValidationError(): string | null {
    if (!this.quizMeta.title.trim()) return 'Vui lòng nhập tiêu đề bộ đề.';
    if (!this.quizMeta.topicId) return 'Vui lòng chọn chủ đề cho bộ đề.';
    if (this.questions.length === 0) return 'Bộ đề cần ít nhất một câu hỏi.';
    const invalidIndex = this.questions.findIndex(question => !this.isQuestionValid(question));
    return invalidIndex >= 0 ? `Câu hỏi ${invalidIndex + 1} cần nội dung, ít nhất hai đáp án và một đáp án đúng.` : null;
  }

  private persistQuiz(questions: any[], isDraft: boolean) {
    if (this.isSaving) return;
    this.isSaving = true;
    this.saveError = '';

    let mappedLevel = 'intermediate'; 
    const currentLevel = (this.quizMeta.level || '').toString().trim().toLowerCase();
    if (currentLevel === 'dễ' || currentLevel === 'beginner') {
      mappedLevel = 'beginner';
    } else if (currentLevel === 'khó' || currentLevel === 'advanced' || currentLevel === 'hard') {
      mappedLevel = 'advanced';
    } else {
      mappedLevel = 'intermediate';
    }

    const requestedTopicId = this.getValidTopicId();
    const requestedTopicName = requestedTopicId ? null : this.getSelectedTopicName();

    if (!requestedTopicId && !requestedTopicName && questions.length > 0) {
      this.isSaving = false;
      this.saveError = 'Vui lòng chọn chủ đề hợp lệ trước khi lưu câu hỏi.';
      this.cdr.detectChanges();
      return;
    }

    const quizSetPayload = {
      title: this.quizMeta.title.trim(),
      description: this.quizMeta.desc ? this.quizMeta.desc.trim() : '', // Khớp tên cột description dưới DB
      mode: 'practice', 
      timeLimitSeconds: (this.quizMeta.duration || 15) * 60,
      isPublic: !isDraft,
      topicId: requestedTopicId,
      topic: requestedTopicName,
      level: mappedLevel,
      allowedCopy: this.quizMeta.allowedCopy ?? true,
      examQuestionCount: this.quizMeta.examUseAllQuestions ? null : (this.quizMeta.examQuestionCount || null)
    };

    const request$ = this.editingQuizId && !this.editingQuizId.toString().startsWith('custom_')
      ? this.http.put<any>(`/api/quiz-sets/${this.editingQuizId}`, quizSetPayload)
      : this.http.post<any>('/api/quiz-sets', quizSetPayload);

    request$.subscribe({
      next: (quizRes: any) => {
        const createdQuiz = quizRes?.data || quizRes;
        const quizSetId = createdQuiz?.id || this.editingQuizId;
        const resolvedTopicId = createdQuiz?.topicId || createdQuiz?.TopicId || requestedTopicId;

        if (!quizSetId || questions.length === 0) {
          this.router.navigate(['/quiz-bank']);
          return;
        }

        if (!resolvedTopicId) {
          this.isSaving = false;
          this.saveError = 'Không thể xác định chủ đề sau khi lưu bộ đề.';
          this.cdr.detectChanges();
          return;
        }

        let completedRequests = 0;
        questions.forEach((q, idx) => {
          const mappedOptions = q.options.map((opt: string, oIdx: number) => ({
            content: opt.trim(),
            isCorrect: oIdx === q.correctIndex,
            orderIndex: oIdx
          }));

          const questionPayload = {
            topicId: resolvedTopicId,
            content: q.text.trim(),
            level: mappedLevel,
            explanation: q.explanation ? q.explanation.trim() : null,
            options: mappedOptions
          };

          const questionRequest$ = q.id 
            ? this.http.put<any>(`/api/questions/${q.id}`, questionPayload)
            : this.http.post<any>('/api/questions', questionPayload);

          questionRequest$.subscribe({
            next: (questionRes: any) => {
              const createdQuestion = questionRes?.data || questionRes;
              const questionId = createdQuestion?.id || q.id;

              if (questionId && !q.id) {
                this.http.post(`/api/quiz-sets/${quizSetId}/questions`, {
                  questionId: questionId,
                  orderIndex: idx + 1
                }).subscribe({
                  next: () => {
                    completedRequests++;
                    if (completedRequests === questions.length) this.router.navigate(['/quiz-bank']);
                  },
                  error: () => {
                    completedRequests++;
                    if (completedRequests === questions.length) this.router.navigate(['/quiz-bank']);
                  }
                });
              } else {
                completedRequests++;
                if (completedRequests === questions.length) this.router.navigate(['/quiz-bank']);
              }
            },
            error: (err: any) => {
              console.error('Không thể lưu câu hỏi:', err);
              this.isSaving = false;
              this.saveError = this.getApiError(err);
              this.cdr.detectChanges();
            }
          });
        });
      },
      error: (err: any) => {
        this.isSaving = false;
        this.saveError = this.getApiError(err);
        this.cdr.detectChanges();
      }
    });
  }

  private getApiError(err: any): string {
    const validationErrors = err?.error?.errors;
    if (validationErrors && typeof validationErrors === 'object') {
      const firstError = Object.values(validationErrors).flat().find(Boolean);
      if (firstError) return String(firstError);
    }
    return err?.error?.message || err?.message || 'Không thể lưu bộ đề. Vui lòng thử lại.';
  }

  private getValidTopicId(): string | null {
    const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (guidRegex.test(this.quizMeta.topicId || '')) {
      return this.quizMeta.topicId;
    }

    const fallbackTopic = this.topics.find(topic => guidRegex.test(topic?.id || ''));
    if (fallbackTopic?.id) {
      this.quizMeta.topicId = fallbackTopic.id;
      return fallbackTopic.id;
    }

    return null;
  }

  private getSelectedTopicName(): string | null {
    const selectedTopic = this.topics.find(topic => topic?.id === this.quizMeta.topicId);
    const name = (selectedTopic?.name || '').toString().trim();
    return name || null;
  }

  getTopicName(topicId: string): string {
    const found = this.topics.find(t => t.id === topicId);
    return found ? found.name : 'Chưa phân loại';
  }

  getLevelName(level: string): string {
    const formatLevel = (level || '').toLowerCase().trim();
    if (formatLevel === 'intermediate' || formatLevel === 'medium' || formatLevel === 'trung bình') return 'Trung bình';
    if (formatLevel === 'advanced' || formatLevel === 'hard' || formatLevel === 'khó') return 'Khó';
    return 'Dễ';
  }
}

