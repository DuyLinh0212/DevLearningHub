import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { QuizService } from '../../../core/services/quiz.service';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar';

@Component({
  selector: 'app-question-import',
  standalone: true,
  imports: [RouterLink, FormsModule, SidebarComponent],
  templateUrl: './question-import.html',
  styleUrl: './question-import.css'
})
export class QuestionImportComponent implements OnInit {
  private quizService = inject(QuizService);

  isDragging: boolean = false;
  fileSelected: boolean = false;
  fileName: string = '';
  fileSize: string = '';

  importSummary = { total: 0, valid: 0, invalid: 0 };
  parsedQuestions: any[] = [];

  ngOnInit() { }

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
      this.processFile(files[0]);
    }
  }

  onFileSelected(event: any) {
    const files = event.target.files;
    if (files && files.length > 0) {
      this.processFile(files[0]);
    }
  }

  private processFile(file: File) {
    this.fileName = file.name;
    this.fileSize = (file.size / 1024).toFixed(1) + ' KB';
    this.fileSelected = true;
    this.simulateFileParsing();
  }

  private simulateFileParsing() {
    this.parsedQuestions = [
      {
        rowNum: 1,
        text: 'Hàm signal() trong Angular có tác dụng khởi tạo giá trị gì?',
        topic: 'Lập trình Frontend',
        level: 'Dễ',
        points: 10,
        optionsCount: 4,
        options: ['Writable Signal', 'Readonly Signal', 'BehaviorSubject', 'Observable'],
        correctIndex: 0,
        explanation: 'Hàm signal() khởi tạo một Writable Signal chứa giá trị phản xạ reactive hệ thống.',
        isValid: true,
        errorMsg: ''
      },
      {
        rowNum: 2,
        text: 'Từ khóa [ForeignKey] quy định mối quan hệ nào trong Entity Framework Core?',
        topic: 'Cơ sở dữ liệu',
        level: 'Trung bình',
        points: 10,
        optionsCount: 4,
        options: ['Khóa chính', 'Khóa ngoại', 'Chỉ mục độc nhất', 'Ràng buộc kiểm tra'],
        correctIndex: 1,
        explanation: 'ForeignKey dùng để thiết lập tường minh mối quan hệ khóa ngoại giữa các thực thể bảng dữ liệu.',
        isValid: true,
        errorMsg: ''
      },
      {
        rowNum: 3,
        text: 'Lỗi trống nội dung tiêu đề câu hỏi trắc nghiệm',
        topic: 'Lập trình Backend',
        level: 'Dễ',
        points: 0,
        optionsCount: 0,
        options: [],
        correctIndex: 0,
        explanation: '',
        isValid: false,
        errorMsg: 'Nội dung câu hỏi không được để trống.'
      },
      {
        rowNum: 4,
        text: 'Middleware nào điều hướng luồng dữ liệu API khớp với Endpoint định nghĩa?',
        topic: 'Lập trình Backend',
        level: 'Trung bình',
        points: 10,
        optionsCount: 4,
        options: ['UseRouting()', 'UseEndpoints()', 'UseAuthorization()', 'UseCors()'],
        correctIndex: 0,
        explanation: '',
        isValid: false,
        errorMsg: 'Chỉ số Index đáp án đúng (CorrectIndex) nằm ngoài phạm vi lựa chọn.'
      }
    ];

    this.calculateSummary();
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
  }

  executeImport() {
    const validQuestions = this.parsedQuestions.filter(q => q.isValid);
    this.quizService.importQuestions(validQuestions).subscribe({
      next: () => {
        alert(`Hệ thống đã trích xuất sạch sẽ và nạp thành công ${validQuestions.length} câu hỏi hợp lệ từ tệp dữ liệu vào cơ sở dữ liệu hệ thống Dev-Learning Hub!`);
        this.clearFile();
      },
      error: (err) => {
        console.error(err);
      }
    });
  }
}
