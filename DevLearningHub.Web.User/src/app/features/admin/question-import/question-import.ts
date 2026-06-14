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

  private readonly contentAliases = ['nội dung câu hỏi', 'nội dung', 'câu hỏi', 'content', 'text', 'question'];
  private readonly topicAliases = ['topicid', 'topic id', 'topic_id', 'topic', 'chủ đề', 'mã chủ đề', 'mã topic'];
  private readonly levelAliases = ['level', 'cấp độ', 'mức độ', 'khó dễ', 'difficulty'];
  private readonly explanationAliases = ['giải thích', 'giải thích chi tiết', 'explanation', 'explain'];
  private readonly optionAAliases = ['a', 'đáp án a', 'option a', 'lựa chọn a', 'optiona'];
  private readonly optionBAliases = ['b', 'đáp án b', 'option b', 'lựa chọn b', 'optionb'];
  private readonly optionCAliases = ['c', 'đáp án c', 'option c', 'lựa chọn c', 'optionc'];
  private readonly optionDAliases = ['d', 'đáp án d', 'option d', 'lựa chọn d', 'optiond'];
  private readonly correctAliases = ['đáp án đúng', 'đáp án', 'correct', 'correctanswer', 'correct answer', 'correct index', 'correctindex'];
  private readonly pointsAliases = ['points', 'điểm', 'điểm số', 'score'];

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

  private handleFileProcessing(file: File) {
    this.fileSelected = true;
    this.fileName = file.name;
    this.fileSize = (file.size / 1024).toFixed(1) + ' KB';
    this.parsedQuestions = [];
    this.importSummary = { total: 0, valid: 0, invalid: 0 };
    
    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    if (file.size > 5 * 1024 * 1024) {
      alert('Tệp tải lên không được vượt quá 5MB.');
      this.clearFile();
      return;
    }

    if (fileExtension !== 'json' && fileExtension !== 'xlsx' && fileExtension !== 'xls') {
      alert('Trình nạp hiện chỉ hỗ trợ tệp JSON hoặc Excel (.xlsx, .xls).');
      this.clearFile();
      return;
    }

    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        if (fileExtension === 'json') {
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
          this.processJsonData(dataArray);
        } else {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(worksheet);
          this.processExcelData(json);
        }
      } catch (err) {
        alert('Tệp tin định dạng không hợp lệ hoặc bị lỗi cấu trúc: ' + err);
        this.clearFile();
      }
    };

    reader.onerror = () => {
      alert('Không thể đọc tệp đã chọn.');
      this.clearFile();
    };

    if (fileExtension === 'json') {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  }

  private processJsonData(dataArray: any[]) {
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

      return this.validateAndMapUser(
        {
          text,
          topic,
          topicId,
          level: q.level ?? q.Level ?? 'Trung bình',
          points: q.points ?? q.Points ?? 10,
          options,
          correctIndex,
          explanation: q.explanation ?? q.Explanation ?? ''
        },
        index
      );
    });
    this.calculateSummary();
    this.cdr.detectChanges();
  }

  private processExcelData(json: any[]) {
    this.parsedQuestions = json.map((row, idx) => {
      const content = this.getValueByAliases(row, this.contentAliases);
      const topicId = this.getValueByAliases(row, this.topicAliases);
      const level = this.getValueByAliases(row, this.levelAliases);
      const explanation = this.getValueByAliases(row, this.explanationAliases);
      const correctVal = this.getValueByAliases(row, this.correctAliases);
      const pointsVal = this.getValueByAliases(row, this.pointsAliases);

      const optionA = this.getValueByAliases(row, this.optionAAliases);
      const optionB = this.getValueByAliases(row, this.optionBAliases);
      const optionC = this.getValueByAliases(row, this.optionCAliases);
      const optionD = this.getValueByAliases(row, this.optionDAliases);

      const correctIndex = this.getCorrectAnswerIndex(correctVal);

      const rawOptions = [optionA, optionB, optionC, optionD];
      const options = rawOptions
        .map(opt => opt !== undefined && opt !== null ? String(opt).trim() : '')
        .filter(opt => opt !== '');

      const points = pointsVal !== undefined && pointsVal !== null && !isNaN(Number(pointsVal))
        ? Number(pointsVal)
        : 10;

      let mappedLevel = 'Trung bình';
      const rawLevel = String(level || '').trim().toLowerCase();
      if (rawLevel === 'easy' || rawLevel === 'beginner' || rawLevel === 'dễ') {
        mappedLevel = 'Dễ';
      } else if (rawLevel === 'medium' || rawLevel === 'intermediate' || rawLevel === 'trung bình' || rawLevel === 'tb') {
        mappedLevel = 'Trung bình';
      } else if (rawLevel === 'hard' || rawLevel === 'advanced' || rawLevel === 'khó') {
        mappedLevel = 'Khó';
      }

      return this.validateAndMapUser(
        {
          text: content ? String(content).trim() : '',
          topic: topicId ? String(topicId).trim() : '',
          topicId: topicId ? String(topicId).trim() : null,
          level: mappedLevel,
          points,
          options,
          correctIndex,
          explanation: explanation ? String(explanation).trim() : ''
        },
        idx
      );
    });
    this.calculateSummary();
    this.cdr.detectChanges();
  }

  private validateAndMapUser(q: any, index: number) {
    const text = q.text || '';
    const topic = q.topic || '';
    const topicId = q.topicId || null;
    const options = q.options || [];
    const correctIndex = q.correctIndex;
    const level = q.level || 'Trung bình';
    const points = q.points ?? 10;
    const explanation = q.explanation || '';

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
      level,
      points,
      optionsCount: options.length,
      options,
      correctIndex,
      explanation,
      isValid,
      errorMsg
    };
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
