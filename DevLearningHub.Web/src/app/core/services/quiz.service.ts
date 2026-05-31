import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class QuizService {
  private mockQuizzes: any = {
    '1': {
      title: 'Tổng quan Kiến trúc Web API với .NET 9',
      status: 'Đã phát hành',
      statusClass: 'public',
      desc: 'Đánh giá năng lực xây dựng cấu trúc REST API, cơ chế Dependency Injection, Middleware và truy vấn dữ liệu thông qua Entity Framework Core.',
      duration: 15,
      shuffle: true,
      instantResult: true,
      updated: 'Vừa cập nhật',
      questions: [
        {
          id: 1,
          points: 100,
          level: 'Trung bình',
          text: 'In ASP.NET Core Web API, which middleware is configured to catch centralized exceptions and return user-friendly JSON errors?',
          options: ['UserRouting()', 'UseAuthentication()', 'UseExceptionHandler()', 'UseAuthorization()'],
          correctIndex: 2
        },
        {
          id: 2,
          points: 100,
          level: 'Trung bình',
          text: 'How many main lifetimes does Dependency Injection support in .NET 9?',
          options: ['2 lifetimes (Transient, Scoped)', '3 lifetimes (Transient, Scoped, Singleton)', '4 lifetimes', '5 lifetimes'],
          correctIndex: 1
        },
        {
          id: 3,
          points: 100,
          level: 'Dễ',
          text: 'Which Data Annotation is used to set a property as a Primary Key in Entity Framework Core?',
          options: ['[Required]', '[ForeignKey]', '[Key]', '[Column]'],
          correctIndex: 2
        }
      ]
    },
    '2': {
      title: 'Tối ưu trạng thái phản xạ với Angular Signals',
      status: 'Bản nháp',
      statusClass: 'draft',
      desc: 'Quản lý trạng thái ứng dụng nâng cao, tối ưu hóa hiệu năng re-render và cơ chế truyền nhận dữ liệu reactive phản xạ từng giây giữa các tầng giao diện.',
      duration: 10,
      shuffle: false,
      instantResult: true,
      updated: '1 ngày trước',
      questions: [
        {
          id: 1,
          points: 100,
          level: 'Dễ',
          text: 'Which function is used to initialize a Writable Signal in Angular?',
          options: ['computed()', 'signal()', 'effect()', 'state()'],
          correctIndex: 1
        }
      ]
    },
    '3': {
      title: 'Cơ bản về cơ chế Routing và Single Page Application',
      status: 'Đang ẩn',
      statusClass: 'hidden',
      desc: 'Tìm hiểu vòng đời component, cơ chế cấu hình định tuyến Routing Segment và phương pháp tối ưu hóa dung lượng file tĩnh tải lên trình duyệt.',
      duration: 20,
      shuffle: true,
      instantResult: true,
      questions: []
    }
  };

  private currentAnswers: (number | null)[] = [];
  private currentTimeSpent: string = '00:00';

  private getCustomQuizzes() {
    const stored = localStorage.getItem('custom_quizzes');
    return stored ? JSON.parse(stored) : {};
  }

  getAllQuizzes() {
    const custom = this.getCustomQuizzes();
    const allQuizzes = { ...this.mockQuizzes, ...custom };

    return Object.keys(allQuizzes).map(key => ({
      id: key,
      title: allQuizzes[key].title,
      status: allQuizzes[key].status,
      statusClass: allQuizzes[key].statusClass,
      desc: allQuizzes[key].desc,
      duration: allQuizzes[key].duration,
      questions: allQuizzes[key].questions ? allQuizzes[key].questions.length : 0,
      attempts: this.getAttempts(key),
      updated: allQuizzes[key].updated
    }));
  }

  getQuiz(id: string) {
    const custom = this.getCustomQuizzes();
    return this.mockQuizzes[id] || custom[id] || { title: 'Bộ đề mẫu', desc: '', duration: 15, shuffle: false, instantResult: false, questions: [] };
  }

  addCustomQuiz(meta: any, questionsData: any[], isDraft: boolean, existingId?: string) {
    const custom = this.getCustomQuizzes();

    const targetId = existingId ? existingId : 'custom_' + Date.now();

    custom[targetId] = {
      title: meta.title,
      status: isDraft ? 'Bản nháp' : 'Đã phát hành',
      statusClass: isDraft ? 'draft' : 'public',
      desc: meta.desc || 'Chưa có mô tả cho bộ đề này.',
      duration: meta.duration || 15,
      shuffle: meta.shuffle,
      instantResult: meta.instantResult,
      updated: existingId ? 'Đã chỉnh sửa' : 'Vừa xong',
      questions: questionsData.map((q, idx) => ({
        id: idx + 1,
        points: q.points || 10,
        level: meta.level,
        text: q.text || '',
        options: q.options.map((o: string) => o || ''),
        correctIndex: q.correctIndex || 0
      }))
    };

    localStorage.setItem('custom_quizzes', JSON.stringify(custom));
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

  getSavedAnswers() {
    return this.currentAnswers;
  }

  getSavedTimeSpent() {
    return this.currentTimeSpent;
  }

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
