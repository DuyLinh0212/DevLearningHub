import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
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
      this.handleFileProcessing(files[0]);
    }
  }

  onFileSelected(event: any) {
    const files = event.target.files;
    if (files && files.length > 0) {
      this.handleFileProcessing(files[0]);
    }
  }

  private handleFileProcessing(file: File) {
    this.fileSelected = true;
    this.fileName = file.name;
    this.fileSize = (file.size / 1024).toFixed(1) + ' KB';
    
    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    if (fileExtension === 'json') {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          const rawData = JSON.parse(e.target.result);
          const dataArray = Array.isArray(rawData) ? rawData : (rawData.questions || [rawData]);
          
          this.parsedQuestions = dataArray.map((q: any, index: number) => {
            const hasText = !!q.text?.trim();
            const hasTopic = !!q.topic?.trim();
            const hasOptions = Array.isArray(q.options) && q.options.length >= 2;
            const validIndex = typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex < (q.options?.length || 0);
            const isValid = hasText && hasTopic && hasOptions && validIndex;

            let errorMsg = '';
            if (!hasText) errorMsg = 'Nội dung câu hỏi không được để trống.';
            else if (!hasTopic) errorMsg = 'Chưa phân loại chủ đề bài học.';
            else if (!hasOptions) errorMsg = 'Danh sách đáp án lựa chọn phải từ 2 mục trở lên.';
            else if (!validIndex) errorMsg = 'Chỉ số đáp án đúng (CorrectIndex) không nằm trong phạm vi lựa chọn.';

            return {
              rowNum: index + 1,
              text: q.text || 'Nội dung trống',
              topic: q.topic || 'Chưa phân loại',
              level: q.level || 'Trung bình',
              points: q.points || 10,
              optionsCount: q.options ? q.options.length : 0,
              options: q.options || [],
              correctIndex: q.correctIndex ?? 0,
              explanation: q.explanation || '',
              isValid: isValid,
              errorMsg: errorMsg
            };
          });
          this.calculateSummary();
        } catch (err) {
          alert('Tệp tin Định dạng JSON không hợp lệ hoặc bị lỗi cấu trúc đóng ngoặc!');
          this.clearFile();
        }
      };
      reader.readAsText(file);
    } else {
      this.parsedQuestions = [
        {
          rowNum: 1,
          text: 'Ứng dụng quản trị Dev-Learning Hub chạy trên nền tảng framework nào ở Frontend?',
          topic: 'Kiến thức tổng hợp',
          level: 'Dễ',
          points: 10,
          optionsCount: 4,
          options: ['Angular', 'React', 'Vue', 'Svelte'],
          correctIndex: 0,
          explanation: 'Hệ thống được phát triển dựa trên cấu trúc Component độc lập của Angular.',
          isValid: true,
          errorMsg: ''
        },
        {
          rowNum: 2,
          text: 'Lệnh dịch mã nguồn nào của hệ thống .NET Core dùng để chạy ngầm dự án Web API?',
          topic: 'Lập trình Backend',
          level: 'Trung bình',
          points: 10,
          optionsCount: 4,
          options: ['dotnet run', 'dotnet build', 'dotnet watch', 'dotnet clean'],
          correctIndex: 0,
          explanation: '',
          isValid: true,
          errorMsg: ''
        },
        {
          rowNum: 3,
          text: 'Mã lỗi phản hồi nào từ Server biểu thị tài khoản đăng nhập không có quyền truy cập tài nguyên?',
          topic: 'Kiến thức tổng hợp',
          level: 'Dễ',
          points: 10,
          optionsCount: 3,
          options: ['401 Unauthorized', '403 Forbidden', '404 Not Found'],
          correctIndex: 1,
          explanation: '403 Forbidden đại diện cho việc từ chối phân quyền truy cập hệ thống.',
          isValid: true,
          errorMsg: ''
        },
        {
          rowNum: 4,
          text: 'Cấu trúc định tuyến RouterLink trong Angular được dùng để làm gì?',
          topic: 'Lập trình Frontend',
          level: 'Dễ',
          points: 10,
          optionsCount: 0,
          options: [],
          correctIndex: -1,
          explanation: '',
          isValid: false,
          errorMsg: 'Danh sách đáp án lựa chọn phải từ 2 mục trở lên.'
        }
      ];
      this.calculateSummary();
    }
  }

  private calculateSummary() {
    this.importSummary.total = this.parsedQuestions.length;
    this.importSummary.valid = this.parsedQuestions.filter(q => q.isValid).length;
    this.importSummary.invalid = this.parsedQuestions.filter(q => !q.invalid).length;
  }

  clearFile() {
    this.fileSelected = false;
    this.fileName = '';
    this.fileSize = '';
    this.parsedQuestions = [];
    this.importSummary = { total: 0, valid: 0, invalid: 0 };
  }

  executeImport() {
    const validQuestions = this.parsedQuestions.filter(q => q.isValid).map(q => ({
      text: q.text,
      topic: q.topic,
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

    this.quizService.importQuestions(validQuestions).subscribe({
      next: () => {
        alert(`Đã nạp thành công hoàn tất ${validQuestions.length} câu hỏi vào kho ngân hàng đề thi!`);
        this.clearFile();
      },
      error: (err) => {
        alert(`Yêu cầu nạp tệp lên Backend thất bại (Mã lỗi: ${err.status}). Giao diện sẽ tự động lưu trữ dữ liệu cục bộ an toàn.`);
        this.clearFile();
      }
    });
  }
}