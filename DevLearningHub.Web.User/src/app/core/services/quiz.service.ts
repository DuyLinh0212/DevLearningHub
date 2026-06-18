import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

const MOCK_QUIZ_SETS: any[] = [];

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
        const rawList = Array.isArray(target) ? target : [];
        const mergedList = [...rawList];
        
        MOCK_QUIZ_SETS.forEach(mockSet => {
          if (!mergedList.some(q => (q.id || q.Id) === mockSet.id)) {
            mergedList.push({
              id: mockSet.id,
              title: mockSet.title,
              description: mockSet.description,
              isPublic: mockSet.isPublic,
              questionCount: mockSet.questionCount,
              timeLimitSeconds: mockSet.timeLimitSeconds,
              level: mockSet.level,
              createdBy: mockSet.createdBy
            });
          }
        });
        
        return mergedList.map((quiz: any) => this.mapQuizSet(quiz));
      })
    );
  }

  getQuiz(id: string): Observable<any> {
    const mock = MOCK_QUIZ_SETS.find(q => q.id === id);
    if (mock) {
      return new Observable(observer => {
        observer.next(this.mapQuizSetDetail(mock));
        observer.complete();
      });
    }
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

toggleQuizStatus(quiz: any): Observable<any> {
    const nextPublic = quiz.statusClass !== 'public';
    const payload = {
      title: quiz.title,
      description: quiz.description || quiz.desc || '',
      mode: quiz.mode || 'practice',
      timeLimitSeconds: (quiz.duration || 15) * 60,
      isPublic: nextPublic,
      topicId: quiz.topicId || null,
      level: quiz.level || 'beginner'
    };
    return this.http.put<any>(`${this.apiUrl}/quiz-sets/${quiz.id}`, payload);
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
    const payload = {
      ...this.mapQuizSetPayload(meta, !isDraft),
      allowedCopy: meta.allowedCopy ?? true,
      questions: questionsData.map((question) => this.mapQuestionPayload(question, meta))
    };
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
    const mock = MOCK_QUIZ_SETS.find((q: any) => q.id === quizSetId);
    if (mock) {
      return new Observable(observer => {
        observer.next({
          sessionId: `session-mock-${quizSetId}-${Date.now()}`,
          title: mock.title,
          timeLimitSeconds: mock.timeLimitSeconds,
          questions: mock.questions.map((q: any) => ({
            questionId: q.questionId,
            content: q.content,
            level: q.level,
            points: 10,
            options: q.options.map((o: any) => ({
              id: o.id,
              content: o.content
            }))
          }))
        });
        observer.complete();
      });
    }
    return this.http.post(`${this.apiUrl}/quiz-sessions`, { quizSetId: quizSetId });
  }

  submitQuizSession(sessionId: string, answersPayload: any[]): Observable<any> {
    if (sessionId && sessionId.startsWith('session-mock-')) {
      return new Observable(observer => {
        const quizId = MOCK_QUIZ_SETS.find((q: any) => sessionId.includes(q.id))?.id || '';
        const mock = MOCK_QUIZ_SETS.find((q: any) => q.id === quizId);
        
        if (mock) {
          let score = 0;
          const answers = mock.questions.map((q: any) => {
            const userAnswer = answersPayload.find((a: any) => a.questionId === q.questionId);
            const userSelectedOptionId = userAnswer ? userAnswer.selectedOptionId : null;
            
            const correctOpt = q.options.find((o: any) => o.isCorrect);
            const correctOptionId = correctOpt ? correctOpt.id : '';
            
            const isCorrect = userSelectedOptionId === correctOptionId;
            if (isCorrect) score++;
            
            return {
              questionId: q.questionId,
              isCorrect: isCorrect,
              selectedOptionId: userSelectedOptionId,
              correctOptionId: correctOptionId,
              explanation: q.explanation
            };
          });
          
          const resultData = {
            sessionId: sessionId,
            score: score,
            totalQuestions: mock.questions.length,
            accuracy: Math.round((score / mock.questions.length) * 100),
            timeTakenSeconds: 45,
            answers: answers
          };
          
          sessionStorage.setItem(`mock_session_result_${sessionId}`, JSON.stringify(resultData));
        }
        observer.next({ success: true });
        observer.complete();
      });
    }
    return this.http.post(`${this.apiUrl}/quiz-sessions/${sessionId}/submit`, { answers: answersPayload });
  }

  getQuizSessionResult(sessionId: string): Observable<any> {
    if (sessionId && sessionId.startsWith('session-mock-')) {
      return new Observable(observer => {
        const stored = sessionStorage.getItem(`mock_session_result_${sessionId}`);
        if (stored) {
          observer.next(JSON.parse(stored));
        } else {
          observer.next({
            sessionId: sessionId,
            score: 0,
            totalQuestions: 0,
            accuracy: 0,
            timeTakenSeconds: 0,
            answers: []
          });
        }
        observer.complete();
      });
    }
    return this.http.get(`${this.apiUrl}/quiz-sessions/${sessionId}/result`);
  }

  private mapQuizSet(quiz: any): any {
    const id = quiz.id || quiz.Id || '';
    const isPub = quiz.isPublic ?? quiz.IsPublic ?? true;
    const qCount = quiz.questionCount ?? quiz.QuestionCount ?? (quiz.questions?.length || quiz.Questions?.length || 0);
    
    const localAttempts = this.getAttempts(id);
    let finalAttempts: number;

    if (id.toString().startsWith('mock-')) {
      // Mock quiz: dùng localStorage vì không có BE thật (số hardcode bỏ qua)
      finalAttempts = localAttempts;
    } else {
      // Quiz thật: ưu tiên BE, fallback localStorage
      const beAttempts = quiz.attemptsCount ?? quiz.AttemptsCount ?? null;
      finalAttempts = (beAttempts !== null && beAttempts > 0) ? beAttempts : localAttempts;
    }
    
    return {
      id,
      createdBy: quiz.createdBy || quiz.CreatedBy || '',
      createdByFullName: quiz.createdByFullName || quiz.CreatedByFullName || '',
      title: quiz.title || quiz.Title || '',
      desc: quiz.description || quiz.Description || '',
      topicId: quiz.topicId || quiz.TopicId || '',
      topic: quiz.topic || quiz.Topic || '',
      level: quiz.level || quiz.Level || '',
      duration: quiz.timeLimitSeconds ? Math.ceil(quiz.timeLimitSeconds / 60) : (quiz.TimeLimitSeconds ? Math.ceil(quiz.TimeLimitSeconds / 60) : 15),
      questionsCount: qCount,
      statusClass: isPub ? 'public' : 'draft',
      status: isPub ? 'Đã phát hành' : 'Bản nháp',
      allowedCopy: quiz.allowedCopy ?? quiz.AllowedCopy ?? true,
      attempts: finalAttempts,
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
        id: question.questionId || question.QuestionId || question.id || question.Id,
        text: question.content || question.Content || '',
        level: question.level || question.Level || '',
        explanation: question.explanation || question.Explanation || '',
        options: (question.options || question.Options || []).map((option: any) =>
          typeof option === 'string' ? option : option.content || option.Content || ''
        ),
        correctIndex: Math.max(
          0,
          (question.options || question.Options || []).findIndex((option: any) => option.isCorrect ?? option.IsCorrect)
        )
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
      allowedCopy: form.allowedCopy ?? true,
      topicId: form.topicId || null,
      topic: form.topic || null,
      level: form.level || null
    };
  }

  private mapQuestionPayload(question: any, meta: any): any {
    const options = Array.isArray(question.options) ? question.options : [];

    return {
      id: question.id || null,
      topicId: question.topicId || meta.topicId || null,
      content: question.text || question.content || '',
      level: question.level || meta.level || null,
      explanation: question.explanation || '',
      options: options.map((option: any, index: number) => ({
        content: typeof option === 'string' ? option : option?.content || option?.Content || '',
        isCorrect: index === question.correctIndex,
        orderIndex: index
      }))
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
    return 0; // Vô hiệu hóa localStorage nghiệp vụ theo yêu cầu của user
  }

  incrementAttempts(id: string): void {
    // Vô hiệu hóa localStorage nghiệp vụ theo yêu cầu của user
  }

  getUserXP(): number {
    return 0; // Vô hiệu hóa localStorage nghiệp vụ theo yêu cầu của user
  }

  addUserXP(xp: number): void {
    // Vô hiệu hóa localStorage nghiệp vụ theo yêu cầu của user
  }

  saveQuizProgress(quizId: string, answeredCount: number, originalTotalCount: number): void {
    // Vô hiệu hóa localStorage nghiệp vụ theo yêu cầu của user
  }

  getQuizProgress(quizId: string): number {
    return 0; // Vô hiệu hóa localStorage nghiệp vụ theo yêu cầu của user
  }

  saveLocalTopicProgress(quizId: string, quizTitle: string, correctCount: number, totalQuestions: number): void {
    // Vô hiệu hóa localStorage nghiệp vụ theo yêu cầu của user
  }

  getLocalTopicProgress(): any[] {
    return []; // Vô hiệu hóa localStorage nghiệp vụ theo yêu cầu của user
  }

  getStreak(): number {
    return 1; // Vô hiệu hóa localStorage nghiệp vụ theo yêu cầu của user
  }
}
