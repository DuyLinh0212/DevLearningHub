import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar';
import { QuizService } from '../../../core/services/quiz.service';

@Component({
  selector: 'app-quiz-management',
  standalone: true,
  imports: [FormsModule, RouterLink, SidebarComponent],
  templateUrl: './quiz-management.html',
  styleUrl: './quiz-management.css'
})
export class QuizManagementComponent implements OnInit, OnDestroy {
  private quizService = inject(QuizService);

  currentSubTab: string = 'bank';
  searchTerm: string = '';
  selectedTopic: string = 'all';
  selectedLevel: string = 'all';
  private intervalId: any;

  topics: string[] = [
    'Lập trình Backend',
    'Lập trình Frontend',
    'Cơ sở dữ liệu',
    'Kiểm thử phần mềm'
  ];

  questionsBank: any[] = [
    { id: 1, text: 'Middleware nào trong .NET 9 dùng để bắt cấu hình xử lý lỗi ngoại lệ toàn cục?', topic: 'Lập trình Backend', level: 'Trung bình', points: 10, isActive: true, options: ['UseStatusCodePages()', 'UseExceptionHandler()', 'UseDeveloperExceptionPage()', 'UseRouting()'], correctIndex: 1, explanation: 'UseExceptionHandler là middleware chuẩn để bắt và xử lý ngoại lệ toàn cục trong môi trường Production.' },
    { id: 2, text: 'Sự khác biệt chính giữa IEnumerable và IQueryable trong LINQ C# là gì?', topic: 'Lập trình Backend', level: 'Trung bình', points: 10, isActive: true, options: ['IEnumerable thực thi ở client, IQueryable thực thi ở server', 'IEnumerable chạy nhanh hơn IQueryable', 'IQueryable không hỗ trợ lazy loading', 'Không có sự khác biệt nào'], correctIndex: 0, explanation: 'IQueryable dịch truy vấn thành câu lệnh SQL để chạy phía Database Server, còn IEnumerable tải toàn bộ dữ liệu về RAM Client rồi mới lọc.' },
    { id: 3, text: 'Angular Signals dùng hàm nào để lắng nghe biến đổi và tự động chạy logic phụ thuộc (Side Effect)?', topic: 'Lập trình Frontend', level: 'Khó', points: 10, isActive: true, options: ['computed()', 'effect()', 'signal()', 'untracked()'], correctIndex: 1, explanation: 'Hàm effect() được sử dụng khi cần chạy các đoạn mã side-effect mỗi khi các signal phụ thuộc bên trong nó có sự thay đổi giá trị.' },
    { id: 4, text: 'Từ khóa [Key] trong Entity Framework Core có tác dụng quy định thuộc tính gì?', topic: 'Cơ sở dữ liệu', level: 'Dễ', points: 10, isActive: true, options: ['Khóa ngoại', 'Khóa chính', 'Chỉ mục Unique', 'Thuộc tính Not Null'], correctIndex: 1, explanation: 'Data Annotation [Key] dùng để chỉ định một thuộc tính cụ thể làm Khóa chính (Primary Key) cho bảng dữ liệu.' }
  ];

  quizSets: any[] = [];

  isQuestionModalOpen: boolean = false;
  isEditingQuestion: boolean = false;
  editingQuestionId: number | null = null;
  questionForm = {
    text: '',
    topic: 'Lập trình Backend',
    level: 'Trung bình',
    points: 10,
    options: ['', '', '', ''],
    correctIndex: 0,
    explanation: ''
  };

  isAssignModalOpen: boolean = false;
  selectedQuizSet: any = null;

  isQuizSetModalOpen: boolean = false;
  isEditingQuizSet: boolean = false;
  editingQuizSetId: string | null = null;
  quizSetForm = {
    title: '',
    desc: '',
    topic: 'Lập trình Backend',
    level: 'Trung bình',
    duration: 15,
    passRate: 70
  };

  ngOnInit() {
    this.loadQuizSets();
    this.startLiveContributionSimulation();
  }

  ngOnDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  loadQuizSets() {
    this.quizService.getAllQuizzes(true).subscribe({
      next: (res) => {
        this.quizSets = res;
      },
      error: (err: any) => {
        console.error(err);
      }
    });
  }

  get filteredQuestions() {
    return this.questionsBank.filter(q => {
      const matchSearch = q.text.toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchTopic = this.selectedTopic === 'all' || q.topic === this.selectedTopic;
      const matchLevel = this.selectedLevel === 'all' || q.level === this.selectedLevel;
      return matchSearch && matchTopic && matchLevel;
    });
  }

  get filteredQuizSets() {
    return this.quizSets.filter(set =>
      set.title.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
      set.desc.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
  }

  switchSubTab(tabName: string) {
    this.currentSubTab = tabName;
    this.searchTerm = '';
  }

  filterByTopic(topic: string) {
    this.selectedTopic = topic;
  }

  getLetterPrefix(index: number): string {
    return String.fromCharCode(65 + index);
  }

  toggleQuestionStatus(q: any) {
    q.isActive = !q.isActive;
  }

  toggleQuizSetStatus(set: any) {
    this.quizService.toggleQuizStatus(set.id, set.statusClass).subscribe({
      next: () => {
        this.loadQuizSets();
      },
      error: (err: any) => {
        console.error(err);
      }
    });
  }

  openQuestionModal(q: any | null = null) {
    if (q) {
      this.isEditingQuestion = true;
      this.editingQuestionId = q.id;
      this.questionForm = {
        text: q.text,
        topic: q.topic,
        level: q.level,
        points: q.points,
        options: [...q.options],
        correctIndex: q.correctIndex,
        explanation: q.explanation
      };
    } else {
      this.isEditingQuestion = false;
      this.editingQuestionId = null;
      this.questionForm = {
        text: '',
        topic: 'Lập trình Backend',
        level: 'Trung bình',
        points: 10,
        options: ['', '', '', ''],
        correctIndex: 0,
        explanation: ''
      };
    }
    this.isQuestionModalOpen = true;
  }

  closeQuestionModal() {
    this.isQuestionModalOpen = false;
  }

  setCorrectAnswer(idx: number) {
    this.questionForm.correctIndex = idx;
  }

  saveQuestion() {
    if (!this.questionForm.text.trim()) {
      alert('Vui lòng nhập nội dung câu hỏi!');
      return;
    }
    if (this.questionForm.options.some(opt => !opt.trim())) {
      alert('Vui lòng nhập đầy đủ nội dung cho cả 4 phương án!');
      return;
    }

    if (this.isEditingQuestion && this.editingQuestionId !== null) {
      const q = this.questionsBank.find(item => item.id === this.editingQuestionId);
      if (q) {
        Object.assign(q, {
          text: this.questionForm.text,
          topic: this.questionForm.topic,
          level: this.questionForm.level,
          points: this.questionForm.points,
          options: [...this.questionForm.options],
          correctIndex: this.questionForm.correctIndex,
          explanation: this.questionForm.explanation
        });
      }
    } else {
      const newId = this.questionsBank.length > 0 ? Math.max(...this.questionsBank.map(item => item.id)) + 1 : 1;
      this.questionsBank.push({
        id: newId,
        text: this.questionForm.text,
        topic: this.questionForm.topic,
        level: this.questionForm.level,
        points: this.questionForm.points,
        isActive: true,
        options: [...this.questionForm.options],
        correctIndex: this.questionForm.correctIndex,
        explanation: this.questionForm.explanation
      });
    }
    this.closeQuestionModal();
  }

  openAssignModal(set: any) {
    this.selectedQuizSet = set;
    this.isAssignModalOpen = true;
  }

  closeAssignModal() {
    this.isAssignModalOpen = false;
    this.selectedQuizSet = null;
  }

  isQuestionInSet(id: number): boolean {
    if (!this.selectedQuizSet) return false;
    return this.selectedQuizSet.questionIds.includes(id);
  }

  toggleQuestionInSet(id: number) {
    if (!this.selectedQuizSet) return;
    const idx = this.selectedQuizSet.questionIds.indexOf(id);
    if (idx > -1) {
      this.selectedQuizSet.questionIds.splice(idx, 1);
    } else {
      this.selectedQuizSet.questionIds.push(id);
    }
  }

  openQuizSetModal(set: any | null = null) {
    if (set) {
      this.isEditingQuizSet = true;
      this.editingQuizSetId = set.id;
      this.quizSetForm = {
        title: set.title,
        desc: set.desc,
        topic: set.topic,
        level: set.level,
        duration: set.duration,
        passRate: set.passRate || 70
      };
    } else {
      this.isEditingQuizSet = false;
      this.editingQuizSetId = null;
      this.quizSetForm = {
        title: '',
        desc: '',
        topic: 'Lập trình Backend',
        level: 'Trung bình',
        duration: 15,
        passRate: 70
      };
    }
    this.isQuizSetModalOpen = true;
  }

  closeQuizSetModal() {
    this.isQuizSetModalOpen = false;
  }

  saveQuizSet() {
    if (!this.quizSetForm.title.trim() || !this.quizSetForm.desc.trim()) {
      alert('Vui lòng nhập đầy đủ tiêu đề và mô tả bộ đề!');
      return;
    }

    const targetId = this.isEditingQuizSet && this.editingQuizSetId ? this.editingQuizSetId : 'custom_' + Date.now();
    this.quizService.saveQuizSetFromAdmin(targetId, this.quizSetForm).subscribe({
      next: () => {
        this.loadQuizSets();
        this.closeQuizSetModal();
      },
      error: (err: any) => {
        console.error(err);
      }
    });
  }

  private startLiveContributionSimulation() {
    this.intervalId = setInterval(() => {
      if (Math.random() > 0.85 && this.questionsBank.length < 8) {
        const fakeContributions = [
          { text: 'Thiết kế hệ thống theo kiến trúc CQRS nhằm giải quyết bài toán gì?', topic: 'Lập trình Backend', level: 'Khó', options: ['Tách biệt luồng đọc và ghi dữ liệu', 'Tự động băm nhỏ database', 'Tăng tốc mã hóa token', 'Đồng bộ giao diện client'], correctIndex: 0, explanation: 'CQRS giúp tối ưu hóa hiệu năng bằng cách chia luồng cập nhật dữ liệu và luồng truy vấn dữ liệu thành các mô hình riêng.' }
        ];
        const picked = fakeContributions[Math.floor(Math.random() * fakeContributions.length)];
        const isExist = this.questionsBank.some(q => q.text === picked.text);
        if (!isExist) {
          const newId = Math.max(...this.questionsBank.map(item => item.id)) + 1;
          this.questionsBank.push({
            id: newId,
            ...picked,
            points: 10,
            isActive: false
          });
        }
      }
    }, 4000);
  }
}
