import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { QuizService } from '../../../core/services/quiz.service';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar';

@Component({
  selector: 'app-question-import',
  standalone: true,
  imports: [RouterLink, FormsModule, SidebarComponent, CommonModule],
  templateUrl: './question-import.html',
  styleUrl: './question-import.css'
  
})
export class QuestionImportComponent implements OnInit {
  private quizService = inject(QuizService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  isDragging: boolean = false;
  fileSelected: boolean = false;
  fileName: string = '';
  fileSize: string = '';
  backLink: string = '/quiz-bank';
  isImporting: boolean = false;

  importSummary = { total: 0, valid: 0, invalid: 0 };
  parsedQuestions: any[] = [];

  ngOnInit() {
    this.backLink = this.router.url.startsWith('/admin') ? '/admin/quiz' : '/quiz-bank';
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

  private handleFileProcessing(file: File) {
    this.fileSelected = true;
    this.fileName = file.name;
    this.fileSize = (file.size / 1024).toFixed(1) + ' KB';
    this.parsedQuestions = [];
    this.importSummary = { total: 0, valid: 0, invalid: 0 };
    
    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    if (file.size > 5 * 1024 * 1024) {
      alert('Tệp JSON không được vượt quá 5MB.');
      this.clearFile();
      return;
    }

    if (fileExtension !== 'json') {
      alert('Trình nạp hiện chỉ hỗ trợ tệp JSON.');
      this.clearFile();
      return;
    }

    if (fileExtension === 'json') {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          const rawData = JSON.parse(e.target.result);
          const dataArray = Array.isArray(rawData)
            ? rawData
            : Array.isArray(rawData?.questions)
              ? rawData.questions
              : rawData && typeof rawData === 'object'
                ? [rawData]
                : [];

          if (dataArray.length === 0) {
            throw new Error('Question list is empty.');
          }
          
          this.parsedQuestions = dataArray.map((q: any, index: number) => {
            const text = q.text ?? q.Text ?? q.content ?? q.Content ?? '';
            const topic = q.topic ?? q.Topic ?? '';
            const topicId = q.topicId ?? q.TopicId ?? null;
            const rawOptions = Array.isArray(q.options ?? q.Options) ? q.options ?? q.Options : [];
            const options = rawOptions.map((option: any) =>
              typeof option === 'string' ? option : option?.content ?? option?.Content ?? ''
            );
            const optionCorrectIndex = rawOptions.findIndex((option: any) =>
              typeof option === 'object' && Boolean(option?.isCorrect ?? option?.IsCorrect)
            );
            const rawCorrectIndex = q.correctIndex ?? q.CorrectIndex;
            const correctIndex = Number.isInteger(rawCorrectIndex) ? Number(rawCorrectIndex) : optionCorrectIndex;
            const hasText = typeof text === 'string' && !!text.trim();
            const hasTopic = (typeof topic === 'string' && !!topic.trim()) || !!topicId;
            const hasOptions = options.length >= 2 && options.every((option: string) => !!option.trim());
            const validIndex = correctIndex >= 0 && correctIndex < options.length;
            const isValid = hasText && hasTopic && hasOptions && validIndex;

            let errorMsg = '';
            if (!hasText) errorMsg = 'Nội dung câu hỏi không được để trống.';
            else if (!hasTopic) errorMsg = 'Chưa phân loại chủ đề bài học.';
            else if (!hasOptions) errorMsg = 'Danh sách đáp án lựa chọn phải từ 2 mục trở lên.';
            else if (!validIndex) errorMsg = 'Chỉ số đáp án đúng (CorrectIndex) không nằm trong phạm vi lựa chọn.';

            return {
              rowNum: index + 1,
              text: text || 'Nội dung trống',
              topic: topic || 'Chưa phân loại',
              topicId,
              level: q.level ?? q.Level ?? 'Trung bình',
              points: q.points ?? q.Points ?? 10,
              optionsCount: options.length,
              options,
              correctIndex,
              explanation: q.explanation ?? q.Explanation ?? '',
              isValid: isValid,
              errorMsg: errorMsg
            };
          });
          this.calculateSummary();
          this.cdr.detectChanges();
        } catch (err) {
          alert('Tệp tin Định dạng JSON không hợp lệ hoặc bị lỗi cấu trúc đóng ngoặc!');
          this.clearFile();
        }
      };
      reader.onerror = () => {
        alert('Unable to read the selected JSON file.');
        this.clearFile();
      };
      reader.readAsText(file);
    }
  }

  private calculateSummary() {
    this.importSummary.total = this.parsedQuestions.length;
    this.importSummary.valid = this.parsedQuestions.filter(q => q.isValid).length;
    this.importSummary.invalid = this.parsedQuestions.filter(q => !q.isValid).length;
  }

  clearFile() {
    this.fileSelected = false;
    this.fileName = '';
    this.fileSize = '';
    this.parsedQuestions = [];
    this.importSummary = { total: 0, valid: 0, invalid: 0 };
    this.cdr.detectChanges();
  }

  executeImport() {
    if (this.isImporting) {
      return;
    }

    const validQuestions = this.parsedQuestions.filter(q => q.isValid).map(q => ({
      text: q.text,
      topic: q.topic,
      topicId: q.topicId,
      level: q.level,
      points: q.points,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation
    }));

    if (validQuestions.length === 0) {
      alert('Không tìm thấy câu hỏi nào hợp lệ để tiến hành nạp vào hệ thống!');
      return;
    }

    this.isImporting = true;
    this.quizService.importQuestions(validQuestions).subscribe({
      next: (result) => {
        this.isImporting = false;
        const createdCount = result?.createdCount ?? validQuestions.length;
        const skippedCount = result?.skippedCount ?? 0;
        alert(`Đã nạp ${createdCount} câu hỏi vào ngân hàng đề.${skippedCount > 0 ? ` Bỏ qua ${skippedCount} câu không hợp lệ.` : ''}`);
        this.clearFile();
      },
      error: (err) => {
        this.isImporting = false;
        alert(err?.error?.message || `Không thể nạp câu hỏi (mã lỗi ${err.status}). Vui lòng đăng nhập lại hoặc kiểm tra dữ liệu.`);
        this.cdr.detectChanges();
      }
    });
  }
}
