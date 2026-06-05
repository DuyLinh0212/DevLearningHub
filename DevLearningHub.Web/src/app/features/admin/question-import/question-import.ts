<<<<<<< Updated upstream
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
=======
import { Component, OnInit, inject, ChangeDetectorRef} from '@angular/core';
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
  private router = inject(Router);
=======
>>>>>>> Stashed changes
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
          
<<<<<<< Updated upstream
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
=======
        this.parsedQuestions = dataArray.map((q: any, index: number) => {
          const contentText = q.content || q.text || q.questionText || '';
          
          let options = q.options;
          if (!options && q.optionA) {
            options = [q.optionA, q.optionB, q.optionC, q.optionD].filter(o => o);
          }
>>>>>>> Stashed changes

          let correctIndex = q.correctIndex;
          if (typeof q.correctAnswer === 'string') {
            const charMap: any = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
            correctIndex = charMap[q.correctAnswer.toUpperCase()] ?? 0;
          }

          const hasText = !!contentText.toString().trim();
          const hasTopic = !!(q.topicId || q.topic || 'Kiến thức chung');
          const hasOptions = Array.isArray(options) && options.length >= 2;
          const validIndex = typeof correctIndex === 'number' && correctIndex >= 0 && correctIndex < options.length;

          const isValid = hasText && hasTopic && hasOptions && validIndex;

          let errorMsg = '';
          if (!hasText) errorMsg = 'Nội dung câu hỏi không được để trống.';
          else if (!hasOptions) errorMsg = 'Danh sách đáp án lựa chọn phải từ 2 mục trở lên.';
          else if (!validIndex) errorMsg = 'Đáp án đúng không hợp lệ.';

          return {
            rowNum: index + 1,
            text: contentText,
            topic: q.topicId || q.topic || 'Kiến thức chung',
            level: q.level || 'Trung bình',
            points: q.points || 10,
            optionsCount: options ? options.length : 0,
            options: options || [],
            correctIndex: correctIndex,
            explanation: q.explanation || '',
            isValid: isValid,
            errorMsg: errorMsg
          };
        });

<<<<<<< Updated upstream
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
=======
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
=======
    } else {
      this.parsedQuestions = [];
      this.calculateSummary();
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
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
=======
    const validQuestions = this.parsedQuestions.filter(q => q.isValid).map(q => {
      let formattedOptions = [];
      
      if (q.options.length > 0 && typeof q.options[0] === 'string') {
        formattedOptions = q.options.map((opt: string, idx: number) => ({
          content: opt,
          isCorrect: idx == q.correctIndex,
          orderIndex: idx
        }));
      } else {
        formattedOptions = q.options.map((opt: any, idx: number) => ({
          content: opt.content || opt.Content || '',
          isCorrect: opt.isCorrect !== undefined ? opt.isCorrect : (opt.IsCorrect || false),
          orderIndex: opt.orderIndex ?? opt.OrderIndex ?? idx
        }));
      }

      return {
        topicId: q.topic,
        content: q.text,
        level: q.level.toString().toLowerCase(),
        explanation: q.explanation,
        options: formattedOptions
      };
    });
>>>>>>> Stashed changes

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
<<<<<<< Updated upstream
        this.isImporting = false;
        alert(err?.error?.message || `Không thể nạp câu hỏi (mã lỗi ${err.status}). Vui lòng đăng nhập lại hoặc kiểm tra dữ liệu.`);
        this.cdr.detectChanges();
=======
        alert(`Yêu cầu nạp tệp lên Backend thất bại (Mã lỗi: ${err.status}). Hãy đảm bảo cột Chủ đề trong file JSON là chuỗi ID Guid hợp lệ dưới Database!`);
        this.clearFile();
>>>>>>> Stashed changes
      }
    });
  }
}
