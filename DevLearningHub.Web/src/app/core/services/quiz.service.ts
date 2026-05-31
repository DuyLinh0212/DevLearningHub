import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class QuizService {
  private defaultQuizzes: any = {
    '1': {
      title: 'Luyện tập C# và .NET Core nâng cao',
      status: 'Đã phát hành',
      statusClass: 'public',
      desc: 'Tuyển tập các câu hỏi kiến trúc hệ thống, dependency injection, middleware xử lý lỗi và tối ưu hóa hiệu năng ứng dụng .NET Core.',
      topic: 'Lập trình Backend',
      level: 'Trung bình',
      duration: 15,
      passRate: 70,
      shuffle: true,
      instantResult: true,
      updated: 'Vừa cập nhật',
      questions: [
        { id: 1, points: 10, level: 'Trung bình', text: 'Middleware nào trong .NET 9 dùng để bắt cấu hình xử lý lỗi ngoại lệ toàn cục?', options: ['UseStatusCodePages()', 'UseExceptionHandler()', 'UseDeveloperExceptionPage()', 'UseRouting()'], correctIndex: 1, explanation: 'UseExceptionHandler là middleware chuẩn để bắt và xử lý ngoại lệ toàn cục trong môi trường Production.' },
        { id: 2, points: 10, level: 'Trung bình', text: 'Sự khác biệt chính giữa IEnumerable và IQueryable trong LINQ C# là gì?', options: ['IEnumerable thực thi ở client, IQueryable thực thi ở server', 'IEnumerable chạy nhanh hơn IQueryable', 'IQueryable không hỗ trợ lazy loading', 'Không có sự khác biệt nào'], correctIndex: 0, explanation: 'IQueryable dịch truy vấn thành câu lệnh SQL để chạy phía Database Server, còn IEnumerable tải toàn bộ dữ liệu về RAM Client rồi mới lọc.' }
      ]
    },
    '2': {
      title: 'Tối ưu trạng thái phản xạ với Angular Signals',
      status: 'Đã phát hành',
      statusClass: 'public',
      desc: 'Quản lý trạng thái ứng dụng nâng cao, tối ưu hóa hiệu năng re-render và cơ chế truyền nhận dữ liệu reactive phản xạ từng giây giữa các tầng giao diện.',
      topic: 'Lập trình Frontend',
      level: 'Khó',
      duration: 10,
      passRate: 70,
      shuffle: false,
      instantResult: true,
      updated: '1 ngày trước',
      questions: [
        { id: 1, points: 10, level: 'Khó', text: 'Angular Signals dùng hàm nào để lắng nghe biến đổi và tự động chạy logic phụ thuộc (Side Effect)?', options: ['computed()', 'effect()', 'signal()', 'untracked()'], correctIndex: 1, explanation: 'Hàm effect() được sử dụng khi cần chạy các đoạn mã side-effect mỗi khi các signal phụ thuộc bên trong nó có sự thay đổi giá trị.' }
      ]
    },
    '3': {
      title: 'Thiết kế và chuẩn hóa Cơ sở dữ liệu',
      status: 'Đã phát hành',
      statusClass: 'public',
      desc: 'Tìm hiểu vòng đời liên kết dữ liệu, thiết lập ràng buộc thực thể, chỉ mục ràng buộc và phương pháp tối ưu hóa câu lệnh truy vấn dữ liệu cốt lõi.',
      topic: 'Cơ sở dữ liệu',
      level: 'Dễ',
      duration: 20,
      passRate: 70,
      shuffle: true,
      instantResult: true,
      updated: '2 ngày trước',
      questions: [
        { id: 1, points: 10, level: 'Dễ', text: 'Từ khóa [Key] trong Entity Framework Core có tác dụng quy định thuộc tính gì?', options: ['Khóa ngoại', 'Khóa chính', 'Chỉ mục Unique', 'Thuộc tính Not Null'], correctIndex: 1, explanation: 'Data Annotation [Key] dùng để chỉ định một thuộc tính cụ thể làm Khóa chính (Primary Key) cho bảng dữ liệu.' }
      ]
    }
  };

  private currentAnswers: (number | null)[] = [];
  private currentTimeSpent: string = '00:00';

  constructor() {
    if (typeof window !== 'undefined' && !localStorage.getItem('hub_quizzes')) {
      localStorage.setItem('hub_quizzes', JSON.stringify(this.defaultQuizzes));
    }
  }

  private getQuizzesFromStorage() {
    if (typeof window === 'undefined') return this.defaultQuizzes;
    const stored = localStorage.getItem('hub_quizzes');
    return stored ? JSON.parse(stored) : this.defaultQuizzes;
  }

  getAllQuizzes(isAdmin: boolean = false) {
    const allQuizzes = this.getQuizzesFromStorage();
    let keys = Object.keys(allQuizzes);

    if (!isAdmin) {
      keys = keys.filter(key => allQuizzes[key].statusClass === 'public');
    }

    return keys.map(key => ({
      id: key,
      title: allQuizzes[key].title,
      status: allQuizzes[key].status,
      statusClass: allQuizzes[key].statusClass,
      desc: allQuizzes[key].desc,
      topic: allQuizzes[key].topic,
      level: allQuizzes[key].level,
      duration: allQuizzes[key].duration,
      passRate: allQuizzes[key].passRate || 70,
      questionsCount: allQuizzes[key].questions ? allQuizzes[key].questions.length : 0,
      questionIds: allQuizzes[key].questions ? allQuizzes[key].questions.map((q: any) => q.id) : [],
      attempts: this.getAttempts(key),
      updated: allQuizzes[key].updated
    }));
  }

  getQuiz(id: string) {
    const allQuizzes = this.getQuizzesFromStorage();
    return allQuizzes[id] || { title: 'Bộ đề mẫu', desc: '', duration: 15, shuffle: false, instantResult: false, questions: [] };
  }

  toggleQuizStatus(id: string) {
    const allQuizzes = this.getQuizzesFromStorage();
    if (allQuizzes[id]) {
      const isPublic = allQuizzes[id].statusClass === 'public';
      allQuizzes[id].statusClass = isPublic ? 'draft' : 'public';
      allQuizzes[id].status = isPublic ? 'Bản nháp' : 'Đã phát hành';
      localStorage.setItem('hub_quizzes', JSON.stringify(allQuizzes));
    }
  }

  saveQuizSetFromAdmin(id: string, form: any) {
    const allQuizzes = this.getQuizzesFromStorage();
    if (allQuizzes[id]) {
      allQuizzes[id].title = form.title;
      allQuizzes[id].desc = form.desc;
      allQuizzes[id].topic = form.topic;
      allQuizzes[id].level = form.level;
      allQuizzes[id].duration = form.duration;
      allQuizzes[id].passRate = form.passRate;
    } else {
      allQuizzes[id] = {
        title: form.title,
        desc: form.desc,
        status: 'Đã phát hành',
        statusClass: 'public',
        topic: form.topic,
        level: form.level,
        duration: form.duration,
        passRate: form.passRate,
        shuffle: true,
        instantResult: true,
        updated: 'Vừa xong',
        questions: []
      };
    }
    localStorage.setItem('hub_quizzes', JSON.stringify(allQuizzes));
  }

  addCustomQuiz(meta: any, questionsData: any[], isDraft: boolean, existingId?: string) {
    const allQuizzes = this.getQuizzesFromStorage();
    const targetId = existingId ? existingId : 'custom_' + Date.now();

    allQuizzes[targetId] = {
      title: meta.title,
      status: isDraft ? 'Bản nháp' : 'Đã phát hành',
      statusClass: isDraft ? 'draft' : 'public',
      desc: meta.desc || 'Chưa có mô tả cho bộ đề này.',
      topic: meta.topic || 'Lập trình Backend',
      level: meta.level || 'Trung bình',
      duration: meta.duration || 15,
      passRate: meta.passRate || 70,
      shuffle: meta.shuffle || false,
      instantResult: meta.instantResult || true,
      updated: existingId ? 'Đã chỉnh sửa' : 'Vừa xong',
      questions: questionsData.map((q, idx) => ({
        id: idx + 1,
        points: q.points || 10,
        level: meta.level || 'Trung bình',
        text: q.text || '',
        options: q.options ? q.options.map((o: string) => o || '') : ['', '', '', ''],
        correctIndex: q.correctIndex || 0,
        explanation: q.explanation || ''
      }))
    };

    localStorage.setItem('hub_quizzes', JSON.stringify(allQuizzes));
  }

  saveResults(answers: (number | null)[], timeSpent: string, quizId: string) {
    this.currentAnswers = [...answers];
    this.currentTimeSpent = timeSpent;
    const quizData = this.getQuiz(quizId);
    let correctCount = 0;
    if (quizData && quizData.questions) {
      quizData.questions.forEach((q: any, idx: number) => {
        if (answers[idx] === q.correctIndex) {
          correctCount++;
        }
      });
    }
    const xpGained = correctCount * 50;
    this.addUserXP(xpGained);
  }

  getSavedAnswers() { return this.currentAnswers; }
  getSavedTimeSpent() { return this.currentTimeSpent; }

  getAttempts(id: string): number {
    const key = `quiz_attempts_${id}`;
    const stored = localStorage.getItem(key);
    return stored ? parseInt(stored, 10) : 0;
  }

  incrementAttempts(id: string): void {
    const key = `quiz_attempts_${id}`;
    const current = this.getAttempts(id);
    localStorage.setItem(key, (current + 1).toString());
  }

  getUserXP(): number {
    const stored = localStorage.getItem('user_accumulated_xp');
    return stored ? parseInt(stored, 10) : 600;
  }

  addUserXP(xp: number): void {
    const currentXP = this.getUserXP();
    localStorage.setItem('user_accumulated_xp', (currentXP + xp).toString());
  }

  getStreak(): number {
    const keyDate = 'user_last_active_date';
    const keyStreak = 'user_streak_count';
    const todayStr = new Date().toDateString();
    const lastActive = localStorage.getItem(keyDate);
    const currentStreak = localStorage.getItem(keyStreak);
    let streak = currentStreak ? parseInt(currentStreak, 10) : 5;
    if (!lastActive) {
      localStorage.setItem(keyDate, todayStr);
      localStorage.setItem(keyStreak, streak.toString());
      return streak;
    }
    if (lastActive !== todayStr) {
      const lastDate = new Date(lastActive);
      const todayDate = new Date(todayStr);
      const diffTime = Math.abs(todayDate.getTime() - lastDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        streak += 1;
      } else if (diffDays > 1) {
        streak = 1;
      }
      localStorage.setItem(keyDate, todayStr);
      localStorage.setItem(keyStreak, streak.toString());
    }
    return streak;
  }
}
