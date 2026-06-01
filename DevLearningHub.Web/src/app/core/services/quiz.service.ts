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
      map((res) => (res.data || []).map((quiz: any) => this.mapQuizSet(quiz)))
    );
  }

  getQuiz(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/quiz-sets/${id}`).pipe(
      map((res) => this.mapQuizSetDetail(res.data))
    );
  }

  toggleQuizStatus(id: string, currentStatusClass?: string): Observable<any> {
    const nextStatus = currentStatusClass === 'public' ? 'draft' : 'public';
    return this.http.put<any>(`${this.apiUrl}/quiz-sets/${id}`, {
      isPublic: nextStatus === 'public'
    }).pipe(map((res) => res.data));
  }

  deleteQuizSet(id: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/quiz-sets/${id}`).pipe(map((res) => res.data));
  }

  saveQuizSetFromAdmin(id: string, form: any): Observable<any> {
    const payload = this.mapQuizSetPayload(form, form.statusClass !== 'draft');
    if (id && !id.startsWith('custom_')) {
      return this.http.put<any>(`${this.apiUrl}/quiz-sets/${id}`, payload).pipe(map((res) => res.data));
    } else {
      return this.http.post<any>(`${this.apiUrl}/quiz-sets`, payload).pipe(map((res) => res.data));
    }
  }

  addCustomQuiz(meta: any, questionsData: any[], isDraft: boolean, existingId?: string): Observable<any> {
    const payload = this.mapQuizSetPayload(meta, !isDraft);

    if (existingId && !existingId.startsWith('custom_')) {
      return this.http.put<any>(`${this.apiUrl}/quiz-sets/${existingId}`, payload).pipe(map((res) => res.data));
    } else {
      return this.http.post<any>(`${this.apiUrl}/quiz-sets`, payload).pipe(map((res) => res.data));
    }
  }

  importQuestions(questionsData: any[]): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/questions/import`, { questions: questionsData }).pipe(map((res) => res.data));
  }

  private mapQuizSet(quiz: any): any {
    return {
      id: quiz.id,
      title: quiz.title,
      desc: quiz.description || '',
      topicId: quiz.topicId,
      topic: quiz.topic || '',
      level: quiz.level || '',
      duration: quiz.timeLimitSeconds ? Math.ceil(quiz.timeLimitSeconds / 60) : 15,
      questions: quiz.questionCount || 0,
      statusClass: quiz.isPublic ? 'public' : 'draft',
      status: quiz.isPublic ? 'Đã phát hành' : 'Bản nháp',
      attempts: 0
    };
  }

  private mapQuizSetDetail(quiz: any): any {
    return {
      ...this.mapQuizSet({
        ...quiz,
        questionCount: quiz.questions?.length || 0
      }),
      shuffle: false,
      instantResult: true,
      questions: (quiz.questions || []).map((question: any) => ({
        id: question.questionId,
        text: question.content,
        level: question.level,
        options: question.options || [],
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
    if (typeof window === 'undefined') return 600;
    const stored = localStorage.getItem('user_accumulated_xp');
    return stored ? parseInt(stored, 10) : 600;
  }

  addUserXP(xp: number): void {
    if (typeof window === 'undefined') return;
    const current = this.getUserXP();
    localStorage.setItem('user_accumulated_xp', (current + xp).toString());
  }

  getStreak(): number {
    if (typeof window === 'undefined') return 5;
    const todayStr = new Date().toDateString();
    const lastActive = localStorage.getItem('user_last_active_date');
    const currentStreak = localStorage.getItem('user_streak_count');
    let streak = currentStreak ? parseInt(currentStreak, 10) : 5;
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
