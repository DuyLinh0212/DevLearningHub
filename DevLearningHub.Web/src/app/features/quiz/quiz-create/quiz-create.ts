import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { QuizService } from '../../../core/services/quiz.service';
import { TopicService } from '../../../core/services/topic.service';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar';

@Component({
  selector: 'app-quiz-create',
  standalone: true,
  imports: [RouterLink, FormsModule, SidebarComponent],
  templateUrl: './quiz-create.html',
  styleUrl: './quiz-create.css'
})
export class QuizCreateComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private quizService = inject(QuizService);
  private topicService = inject(TopicService);
  private cdr = inject(ChangeDetectorRef);

  currentStep: number = 1;
  isPreviewModalOpen: boolean = false;
  editingQuizId: string | null = null;
<<<<<<< Updated upstream
  isSaving: boolean = false;
  saveError: string = '';
  importFeedback: string = '';
  importError: string = '';
  topics: any[] = [];
  private readonly defaultTopicNames = [
=======

  topics: string[] = [
>>>>>>> Stashed changes
    'Lập trình Backend',
    'Lập trình Frontend',
    'Cơ sở dữ liệu',
    'Kiểm thử phần mềm',
    'An toàn thông tin'
  ];

  quizMeta = {
    title: '',
    desc: '',
<<<<<<< Updated upstream
    topicId: '',
    topic: '',
    level: 'Trung bình',
=======
    topic: 'Lập trình Backend',
    level: 'intermediate',
>>>>>>> Stashed changes
    duration: 15,
    passRate: 70,
    shuffle: true,
    instantResult: true
  };

  questions: any[] = [this.createEmptyQuestion()];

  ngOnInit() {
<<<<<<< Updated upstream
    this.loadTopics();
=======
    this.route.queryParams.subscribe(params => {
      if (params['id']) {
        this.editingQuizId = params['id'];
        this.quizService.getQuiz(this.editingQuizId!).subscribe({
          next: (existingData) => {
            if (existingData) {
              this.quizMeta = {
                title: existingData.title,
                desc: existingData.desc,
                topic: existingData.topic || 'Lập trình Backend',
                level: existingData.level || 'intermediate',
                duration: existingData.duration,
                passRate: existingData.passRate || 70,
                shuffle: existingData.shuffle !== undefined ? existingData.shuffle : true,
                instantResult: existingData.instantResult !== undefined ? existingData.instantResult : true
              };
>>>>>>> Stashed changes

    this.route.queryParams.subscribe(params => {
      if (!params['id']) {
        return;
      }

      this.editingQuizId = params['id'];
      this.quizService.getQuiz(this.editingQuizId!).subscribe({
        next: (existingData) => {
          if (!existingData) {
            return;
          }

          this.quizMeta = {
            title: existingData.title,
            desc: existingData.desc,
            topicId: existingData.topicId || '',
            topic: existingData.topic || '',
            level: existingData.level || 'Trung bình',
            duration: existingData.duration,
            passRate: existingData.passRate || 70,
            shuffle: existingData.shuffle !== undefined ? existingData.shuffle : true,
            instantResult: existingData.instantResult !== undefined ? existingData.instantResult : true
          };

          if (existingData.questions?.length > 0) {
            this.questions = existingData.questions.map((question: any) => ({
              id: question.id,
              points: question.points || 10,
              type: question.type || 'single',
              text: question.text,
              options: [...question.options],
              correctIndex: question.correctIndex,
              explanation: question.explanation || ''
            }));
          }

          this.syncSelectedTopicName();
        },
        error: (err) => {
          this.saveError = this.getApiError(err);
        }
      });
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

  prevStep() {
    this.currentStep = 1;
  }

  addQuestion() {
    this.questions.push(this.createEmptyQuestion());
  }

  removeQuestion(index: number) {
    if (this.questions.length > 1) {
      this.questions.splice(index, 1);
    }
  }

  setCorrectAnswer(questionIndex: number, optionIndex: number) {
    this.questions[questionIndex].correctIndex = optionIndex;
  }

  onTopicChange(topicName: string) {
    this.quizMeta.topic = topicName;
    this.quizMeta.topicId = this.topics.find(topic => topic.name === topicName)?.id || '';
  }

  onQuestionFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    this.importFeedback = '';
    this.importError = '';

    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith('.json')) {
      this.importError = 'Phần tạo bộ đề hiện hỗ trợ import tệp JSON.';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.importError = 'Tệp JSON không được vượt quá 5MB.';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rawData = JSON.parse(String(reader.result));
        const rows = Array.isArray(rawData)
          ? rawData
          : Array.isArray(rawData?.questions)
            ? rawData.questions
            : rawData && typeof rawData === 'object'
              ? [rawData]
              : [];

        const importedQuestions = rows
          .map((row: any) => this.mapImportedQuestion(row))
          .filter((question: any) => this.isQuestionValid(question));
        const skippedCount = rows.length - importedQuestions.length;

        if (importedQuestions.length === 0) {
          this.importError = 'Không tìm thấy câu hỏi hợp lệ trong tệp JSON.';
          this.cdr.detectChanges();
          return;
        }

        if (this.questions.length === 1 && this.isBlankQuestion(this.questions[0])) {
          this.questions = [];
        }

        this.questions.push(...importedQuestions);
        this.importFeedback = `Đã thêm ${importedQuestions.length} câu hỏi từ ${file.name}.` +
          (skippedCount > 0 ? ` Bỏ qua ${skippedCount} dòng không hợp lệ.` : '');
        this.cdr.detectChanges();
      } catch {
        this.importError = 'Tệp JSON không hợp lệ hoặc sai cấu trúc.';
        this.cdr.detectChanges();
      }
    };
    reader.onerror = () => {
      this.importError = 'Không thể đọc tệp JSON đã chọn.';
      this.cdr.detectChanges();
    };
    reader.readAsText(file);
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

  closePreview() {
    this.isPreviewModalOpen = false;
  }

  saveDraft() {
    if (!this.quizMeta.title.trim()) {
      this.saveError = 'Vui lòng nhập tiêu đề bộ đề.';
      return;
    }

    const validQuestions = this.questions.filter(question => this.isQuestionValid(question));
    if (validQuestions.length > 0 && !this.quizMeta.topicId && !this.quizMeta.topic.trim()) {
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
      next: (topics) => {
        this.topics = topics.length > 0
          ? topics
          : this.defaultTopicNames.map(name => ({ id: '', name }));
        if (!this.quizMeta.topic && this.topics.length > 0) {
          this.quizMeta.topic = this.topics[0].name;
          this.quizMeta.topicId = this.topics[0].id || '';
        }
        this.syncSelectedTopicName();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.saveError = this.getApiError(err);
      }
    });
  }

  private syncSelectedTopicName() {
    const selectedTopic = this.topics.find(topic => topic.id && topic.id === this.quizMeta.topicId);
    if (selectedTopic) {
      this.quizMeta.topic = selectedTopic.name;
    }
  }

  private createEmptyQuestion() {
    return {
      points: 10,
      type: 'single',
      text: '',
      options: ['', '', '', ''],
      correctIndex: 0,
      explanation: ''
    };
  }

  private mapImportedQuestion(row: any) {
    const rawOptions = Array.isArray(row?.options ?? row?.Options) ? row.options ?? row.Options : [];
    const options = rawOptions.map((option: any) =>
      typeof option === 'string' ? option : option?.content ?? option?.Content ?? ''
    );
    const optionCorrectIndex = rawOptions.findIndex((option: any) =>
      typeof option === 'object' && Boolean(option?.isCorrect ?? option?.IsCorrect)
    );
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

  private isBlankQuestion(question: any) {
    return !String(question?.text || '').trim() &&
      (question?.options || []).every((option: any) => !String(option || '').trim());
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
    if (!this.quizMeta.title.trim()) {
      return 'Vui lòng nhập tiêu đề bộ đề.';
    }

    if (!this.quizMeta.topicId && !this.quizMeta.topic.trim()) {
      return 'Vui lòng chọn chủ đề cho bộ đề.';
    }

    if (this.questions.length === 0) {
      return 'Bộ đề cần ít nhất một câu hỏi.';
    }

    const invalidIndex = this.questions.findIndex(question => !this.isQuestionValid(question));
    return invalidIndex >= 0
      ? `Câu hỏi ${invalidIndex + 1} cần nội dung, ít nhất hai đáp án và một đáp án đúng.`
      : null;
  }

  private persistQuiz(questions: any[], isDraft: boolean) {
    if (this.isSaving) {
      return;
    }

    this.isSaving = true;
    this.saveError = '';
    this.quizService.addCustomQuiz(this.quizMeta, questions, isDraft, this.editingQuizId || undefined).subscribe({
      next: () => {
        this.router.navigate(['/quiz-bank']);
      },
      error: (err) => {
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
      if (firstError) {
        return String(firstError);
      }
    }

    return err?.error?.message || err?.message || 'Không thể lưu bộ đề. Vui lòng thử lại.';
  }
}