import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ProblemSummary {
  id: string;
  topicId: string;
  createdBy: string;
  title: string;
  difficulty: string;
  isActive: boolean;
  createdAt: string;
  testCaseCount: number;
  tags: string[];
  reviewStatus?: string;
  reviewNote?: string | null;
}

export interface PublicTestCase {
  id: string;
  input: string;
  expectedOutput: string;
  orderIndex: number;
}

export interface ProblemDetail {
  id: string;
  topicId: string;
  createdBy: string;
  title: string;
  description: string;
  difficulty: string;
  starterCode: string | null;
  languageIds: number[];
  isActive: boolean;
  createdAt: string;
  tags: string[];
  sampleTestCases: PublicTestCase[];
}

export interface ProgrammingLanguageOption {
  id: number;
  name: string;
  slug: string;
  judge0LanguageId: number;
}

export interface CodeRunResponse {
  stdout: string | null;
  stderr: string | null;
  compileOutput: string | null;
  status: string;
  runtimeMs: number | null;
  memoryKb: number | null;
}

export interface CodeSubmitResponse {
  submissionId: string;
  verdict: string;
  passedCases: number;
  totalCases: number;
  runtimeMs: number | null;
  memoryKb: number | null;
}

export interface SubmissionSummary {
  id: string;
  problemId: string;
  problemTitle: string;
  language: string;
  verdict: string;
  passedCases: number;
  totalCases: number;
  runtimeMs: number | null;
  memoryKb: number | null;
  submittedAt: string;
}

export interface SubmissionTestResult {
  testCaseId: string;
  status: string;
  actualOutput: string | null;
  runtimeMs: number | null;
  memoryKb: number | null;
  isHidden: boolean;
  input: string;
  expectedOutput: string;
  orderIndex: number;
}

export interface SubmissionDetail extends SubmissionSummary {
  code: string;
  stdout: string | null;
  stderr: string | null;
  compileOutput: string | null;
  testResults: SubmissionTestResult[];
}

@Injectable({
  providedIn: 'root'
})
export class CodeService {
  private http = inject(HttpClient);

  getProblems(options?: { mine?: boolean }): Observable<ProblemSummary[]> {
    const params: Record<string, string> = {};
    if (options?.mine) {
      params['mine'] = 'true';
    }
    return this.http.get<ProblemSummary[]>('/api/problems', { params });
  }

  getProblem(id: string): Observable<ProblemDetail> {
    return this.http.get<ProblemDetail>(`/api/problems/${id}`);
  }

  getProgrammingLanguages(): Observable<ProgrammingLanguageOption[]> {
    return this.http.get<ProgrammingLanguageOption[]>('/api/programming-languages');
  }

  runCode(code: string, languageId: number, stdin: string): Observable<CodeRunResponse> {
    return this.http.post<CodeRunResponse>('/api/code/run', { code, languageId, stdin });
  }

  submitCode(problemId: string, code: string, languageId: number): Observable<CodeSubmitResponse> {
    return this.http.post<CodeSubmitResponse>('/api/code/submit', { problemId, code, languageId });
  }

  getSubmissions(): Observable<SubmissionSummary[]> {
    return this.http.get<SubmissionSummary[]>('/api/submissions');
  }

  getSubmissionDetail(id: string): Observable<SubmissionDetail> {
    return this.http.get<SubmissionDetail>(`/api/submissions/${id}`);
  }

  reportProblem(problemId: string, description: string): Observable<any> {
    return this.http.post<any>(`/api/problems/${problemId}/report`, { description }).pipe(
      map(res => res?.data || res)
    );
  }
}
