import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { QuizService } from '../../../core/services/quiz.service';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar';
import * as XLSX from 'xlsx';

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

handleFileProcessing(file: File) {
    this.fileSelected = true;
    this.fileName = file.name;
    this.fileSize = (file.size / 1024).toFixed(1) + ' KB';
    
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
        this.clearFile();
      }
    };

    if (fileExtension === 'json') reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
  }

  private processJsonData(data: any) {
    const arr = Array.isArray(data) ? data : (data.questions || [data]);
    this.parsedQuestions = arr.map((q: any, idx: number) => this.validateAndMap(q, idx));
    this.calculateSummary();
  }

private processExcelData(json: any[]) {
  this.parsedQuestions = json.map((row, idx) => {
    const cleanRow: any = {};
    Object.keys(row).forEach(key => {
      cleanRow[key.trim().toLowerCase()] = row[key];
    });

    const q = {
      content: cleanRow['nội dung'] || cleanRow['nội dung câu hỏi'],
      topicId: cleanRow['topicid'] || cleanRow['topic id'],
      level: cleanRow['level'] || 'beginner',
      explanation: cleanRow['giải thích'] || '',
      options: [
        { content: cleanRow['a'], isCorrect: String(cleanRow['đáp án đúng'] || '').toUpperCase() === 'A' },
        { content: cleanRow['b'], isCorrect: String(cleanRow['đáp án đúng'] || '').toUpperCase() === 'B' },
        { content: cleanRow['c'], isCorrect: String(cleanRow['đáp án đúng'] || '').toUpperCase() === 'C' },
        { content: cleanRow['d'], isCorrect: String(cleanRow['đáp án đúng'] || '').toUpperCase() === 'D' }
      ]
    };
    
    console.log(`Dòng ${idx + 1} sau khi map:`, q); 
    
    return this.validateAndMap(q, idx);
  });
  this.calculateSummary();
}

private validateAndMap(q: any, index: number) {
    const options = q.options || [];
    
    const textContent = q.content || q.text || '';
    const topicIdentifier = q.topicId || '';

    const hasText = typeof textContent === 'string' && !!textContent.trim();
    const hasTopic = !!topicIdentifier;
    const hasOptions = options.length >= 2;

    const isValid = hasText && hasTopic && hasOptions;

    let errorMsg = '';
    if (!hasText) errorMsg = 'Nội dung câu hỏi không được để trống.';
    else if (!hasTopic) errorMsg = 'Mã TopicId định danh đang bị bỏ trống.';
    else if (!hasOptions) errorMsg = 'Danh sách đáp án lựa chọn phải từ 2 mục trở lên.';

    return {
      rowNum: index + 1,
      text: textContent,      
      topic: topicIdentifier, 
      topicId: topicIdentifier,
      level: q.level || 'beginner',
      explanation: q.explanation || '',
      optionsCount: options.length,
      options: options,
      isValid: isValid,
      errorMsg: errorMsg
    };
  }

private calculateSummary() {
    this.importSummary = {
      total: this.parsedQuestions.length,
      valid: this.parsedQuestions.filter(q => q.isValid).length,
      invalid: this.parsedQuestions.filter(q => !q.isValid).length
    };
    this.cdr.detectChanges();
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

  console.log('=== PAYLOAD MẢNG RAW CHÍNH THỨC GỬI LÊN BACKEND ===', payload);

  this.quizService.importQuestions(payload).subscribe({
    next: () => {
      this.isImporting = false;
      alert(`Đã nạp thành công ${payload.length} câu hỏi vào hệ thống!`);
      this.clearFile();
    },
    error: (err) => {
      this.isImporting = false;
      console.error('Lỗi chi tiết từ API Backend:', err);

      if (err.error && err.error.errors) {
        console.table(err.error.errors);
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
