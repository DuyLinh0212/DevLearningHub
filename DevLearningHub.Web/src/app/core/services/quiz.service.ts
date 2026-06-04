import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class QuizService {
  private http = inject(HttpClient);
  private apiUrl = '/api';

  private currentAnswers: (number | null)[] = [];
  private currentTimeSpent: string = '00:00';

  getAllQuizzes(isAdmin: boolean = false): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/quiz-sets`, {
      params: isAdmin ? { includePrivate: true } : {}
    }).pipe(
      map((res) => {
        const target = res?.data || res || [];
        return (Array.isArray(target) ? target : []).map((quiz: any) => this.mapQuizSet(quiz));
      })
    );
  }

  getQuiz(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/quiz-sets/${id}`).pipe(
      map((res) => this.mapQuizSetDetail(res?.data || res))
    );
  }

  getLeaderboard(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/users/leaderboard`);
  }

  getCurrentUser(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/users/me`);
  }

  toggleQuizStatus(id: string, currentStatusClass?: string): Observable<any> {
    const nextStatus = currentStatusClass === 'public' ? 'draft' : 'public';
    return this.http.put<any>(`${this.apiUrl}/quiz-sets/${id}`, {
      isPublic: nextStatus === 'public'
    }).pipe(map((res) => res?.data || res));
  }

  deleteQuizSet(id: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/quiz-sets/${id}`).pipe(map((res) => res?.data || res));
  }

  saveQuizSetFromAdmin(id: string, form: any): Observable<any> {
    const payload = this.mapQuizSetPayload(form, form.statusClass !== 'draft');
    if (id && !id.toString().startsWith('custom_')) {
      return this.http.put<any>(`${this.apiUrl}/quiz-sets/${id}`, payload).pipe(map((res) => res?.data || res));
    } else {
      return this.http.post<any>(`${this.apiUrl}/quiz-sets`, payload).pipe(map((res) => res?.data || res));
    }
  }

  assignQuestionToSet(quizSetId: string, questionId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/quiz-sets/${quizSetId}/questions`, { questionId });
  }

  removeQuestionFromSet(quizSetId: string, questionId: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/quiz-sets/${quizSetId}/questions/${questionId}`);
  }

  getAllQuestions(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/questions`);
  }

  saveQuestionFromAdmin(id: string, form: any): Observable<any> {
    if (id && !id.toString().startsWith('new_')) {
      return this.http.put<any>(`${this.apiUrl}/questions/${id}`, form).pipe(map((res) => res?.data || res));
    } else {
      return this.http.post<any>(`${this.apiUrl}/questions`, form).pipe(map((res) => res?.data || res));
    }
  }

  addCustomQuiz(meta: any, questionsData: any[], isDraft: boolean, existingId?: string): Observable<any> {
    const payload = this.mapQuizSetPayload(meta, !isDraft);
    if (existingId && !existingId.toString().startsWith('custom_')) {
      return this.http.put<any>(`${this.apiUrl}/quiz-sets/${existingId}`, payload).pipe(map((res) => res?.data || res));
    } else {
      return this.http.post<any>(`${this.apiUrl}/quiz-sets`, payload).pipe(map((res) => res?.data || res));
    }
  }

  importQuestions(questionsData: any[]): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/questions/import`, questionsData).pipe(map((res) => res?.data || res));
  }

  startQuizSession(quizSetId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/quiz-sessions`, { quizSetId });
  }

  submitQuizSession(sessionId: string, answersPayload: any[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/quiz-sessions/${sessionId}/submit`, { answers: answersPayload });
  }

  getQuizSessionResult(sessionId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/quiz-sessions/${sessionId}/result`);
  }

  private mapQuizSet(quiz: any): any {
    const id = quiz.id || quiz.Id || '';
    const isPub = quiz.isPublic ?? quiz.IsPublic ?? true;
    const qCount = quiz.questionCount ?? quiz.QuestionCount ?? (quiz.questions?.length || quiz.Questions?.length || 0);
    
    return {
      id,
      title: quiz.title || quiz.Title || '',
      desc: quiz.description || quiz.Description || '',
      topicId: quiz.topicId || quiz.TopicId || '',
      topic: quiz.topic || quiz.Topic || '',
      level: quiz.level || quiz.Level || '',
      duration: quiz.timeLimitSeconds ? Math.ceil(quiz.timeLimitSeconds / 60) : (quiz.TimeLimitSeconds ? Math.ceil(quiz.TimeLimitSeconds / 60) : 15),
      questionsCount: qCount,
      statusClass: isPub ? 'public' : 'draft',
      status: isPub ? 'Đã phát hành' : 'Bản nháp',
      attempts: this.getAttempts(id),
      questionIds: quiz.questionIds || []
    };
  }

  private mapQuizSetDetail(quiz: any): any {
    const base = this.mapQuizSet(quiz);
    const rawQuestions = quiz.questions || quiz.Questions || [];
    
    return {
      ...base,
      shuffle: false,
      instantResult: true,
      questions: rawQuestions.map((question: any) => ({
        id: question.questionId || question.Id,
        text: question.content || question.Content || '',
        level: question.level || question.Level || '',
        options: question.options || question.Options || [],
        correctIndex: 0
      }))
    };
  }

  private mapQuizSetPayload(form: any, isPublic: boolean): any {
    return {
      title: form.title,
      description: form.desc || form.description || '',
      mode: form.mode || 'practice',
      timeLimitSeconds: (form.duration || 15) * 60,
      isPublic,
      topicId: form.topicId || null,
      level: form.level || null
    };
  }

  saveResults(answers: (number | null)[], timeSpent: string, quizId: string) {
    this.currentAnswers = [...answers];
    this.currentTimeSpent = timeSpent;
  }

  getSavedAnswers() {
    return this.currentAnswers;
  }

  getSavedTimeSpent() {
    return this.currentTimeSpent;
  }

  getAttempts(id: string): number {
    if (typeof window === 'undefined') return 0;
    const stored = localStorage.getItem(`quiz_attempts_${id}`);
    return stored ? parseInt(stored, 10) : 0;
  }

  incrementAttempts(id: string): void {
    if (typeof window === 'undefined') return;
    const current = this.getAttempts(id);
    localStorage.setItem(`quiz_attempts_${id}`, (current + 1).toString());
  }

  getUserXP(): number {
    if (typeof window === 'undefined') return 0;
    const stored = localStorage.getItem('user_accumulated_xp');
    return stored ? parseInt(stored, 10) : 0;
  }

  addUserXP(xp: number): void {
    if (typeof window === 'undefined') return;
    const current = this.getUserXP();
    localStorage.setItem('user_accumulated_xp', (current + xp).toString());
  }

  getStreak(): number {
    if (typeof window === 'undefined') return 1;
    const todayStr = new Date().toDateString();
    const lastActive = localStorage.getItem('user_last_active_date');
    const currentStreak = localStorage.getItem('user_streak_count');
    let streak = currentStreak ? parseInt(currentStreak, 10) : 1;
    if (!lastActive) {
      localStorage.setItem('user_last_active_date', todayStr);
      localStorage.setItem('user_streak_count', streak.toString());
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
      localStorage.setItem('user_last_active_date', todayStr);
      localStorage.setItem('user_streak_count', streak.toString());
    }
    return streak;
  }
}