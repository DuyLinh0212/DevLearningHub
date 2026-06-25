import { Component, OnInit, inject, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CodeService, ProblemDetail, SubmissionSummary, SubmissionDetail } from '../../../core/services/code.service';
import { HttpClient } from '@angular/common/http';

interface LanguageOption {
  id: number;
  name: string;
  slug: string;
}

@Component({
  selector: 'app-code-playground-workspace',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './code-playground-workspace.html',
  styleUrl: './code-playground-workspace.css'
})
export class CodePlaygroundWorkspaceComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private codeService = inject(CodeService);
  private cdr = inject(ChangeDetectorRef);

  problemId = '';
  problem: ProblemDetail | null = null;
  isLoading = true;

  // Language support
  languages: LanguageOption[] = [
    { id: 71, name: 'Python 3', slug: 'python' },
    { id: 63, name: 'JavaScript', slug: 'javascript' },
    { id: 74, name: 'TypeScript', slug: 'typescript' },
    { id: 62, name: 'Java', slug: 'java' },
    { id: 54, name: 'C++', slug: 'cpp' },
    { id: 50, name: 'C', slug: 'c' }
  ];
  selectedLanguage = this.languages[0];

  // Editor states
  userCode = '';
  lineCountArr: number[] = [1];
  fontSize = 14;

  // Tabs control
  activeLeftTab: 'description' | 'submissions' = 'description';
  activeConsoleTab: 'testcase' | 'result' = 'testcase';

  // Stdin & Execution states
  stdinInput = '';
  isExecuting = false;
  runResult: any = null;
  submissionResult: any = null;
  lastAction: 'run' | 'submit' | null = null;

  // Submission History
  submissions: SubmissionSummary[] = [];
  selectedSubmission: SubmissionDetail | null = null;
  showSubmissionDetail = false;

  // Fallback starter templates
  private starterTemplates: Record<string, string> = {
    'python': `import sys

def solve():
    # Write your python code here
    # Example: read from stdin
    # lines = sys.stdin.read().split()
    pass

if __name__ == '__main__':
    solve()
`,
    'javascript': `const fs = require('fs');

function solve() {
    // Write your javascript code here
    // Example: read from /dev/stdin
    // const input = fs.readFileSync('/dev/stdin', 'utf-8').trim().split(/\\s+/);
}

solve();
`,
    'typescript': `// Write your typescript code here
console.log("Hello, TypeScript!");
`,
    'java': `import java.util.*;
import java.io.*;

public class Main {
    public static void main(String[] args) throws IOException {
        // Write your java code here
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
    }
}
`,
    'cpp': `#include <iostream>
#include <vector>
#include <string>
using namespace std;

int main() {
    // Write your C++ code here
    return 0;
}
`,
    'c': `#include <stdio.h>
#include <stdlib.h>

int main() {
    // Write your C code here
    return 0;
}
`
  };

  ngOnInit() {
    this.problemId = this.route.snapshot.paramMap.get('id') || '';
    if (this.problemId) {
      this.loadProblem();
      this.loadSubmissions();
    } else {
      this.router.navigate(['/code']);
    }
  }

  loadProblem() {
    this.isLoading = true;
    this.codeService.getProblem(this.problemId).subscribe({
      next: (res) => {
        this.problem = res;
        this.isLoading = false;

        // Populate sample input into Console tab
        if (res.sampleTestCases && res.sampleTestCases.length > 0) {
          this.stdinInput = res.sampleTestCases[0].input;
        }

        // Set default starter code
        this.loadStarterCode();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi tải chi tiết bài tập:', err);
        this.isLoading = false;
        alert('Không thể tải thông tin bài tập này.');
        this.router.navigate(['/code']);
      }
    });
  }

  loadSubmissions() {
    this.codeService.getSubmissions().subscribe({
      next: (res) => {
        // Filter submissions for this problem
        this.submissions = (res || []).filter(s => s.problemId.toLowerCase() === this.problemId.toLowerCase());
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi tải lịch sử nộp bài:', err);
      }
    });
  }

  loadStarterCode() {
    if (!this.problem) return;

    // If database provides a starter code, and it contains matching signature/comments, try to use it.
    // Otherwise, use fallback language templates.
    if (this.problem.starterCode && this.isMatchingStarterCode(this.problem.starterCode, this.selectedLanguage.slug)) {
      this.userCode = this.problem.starterCode;
    } else {
      this.userCode = this.starterTemplates[this.selectedLanguage.slug] || '';
    }

    this.updateLineNumbers();
  }

  private isMatchingStarterCode(code: string, slug: string): boolean {
    const c = code.toLowerCase();
    if (slug === 'cpp' && (c.includes('#include') || c.includes('std::') || c.includes('cin >>'))) return true;
    if (slug === 'python' && (c.includes('def ') || c.includes('import sys'))) return true;
    if (slug === 'javascript' && (c.includes('require(') || c.includes('console.log'))) return true;
    if (slug === 'java' && (c.includes('class ') || c.includes('public static void'))) return true;
    if (slug === 'c' && (c.includes('#include <stdio.h>') || c.includes('printf('))) return true;
    return false; // Fallback to templates for safety
  }

  onLanguageChange() {
    if (confirm('Thay đổi ngôn ngữ sẽ khôi phục trình biên tập về code mẫu gốc. Bạn muốn tiếp tục?')) {
      this.loadStarterCode();
    }
  }

  resetCode() {
    if (confirm('Bạn có chắc chắn muốn khôi phục code về mẫu mặc định ban đầu không?')) {
      this.loadStarterCode();
    }
  }

  updateLineNumbers() {
    const lines = this.userCode.split('\n');
    this.lineCountArr = Array.from({ length: Math.max(lines.length, 1) }, (_, i) => i + 1);
  }

  onKeyDown(event: KeyboardEvent) {
    const textarea = event.target as HTMLTextAreaElement;
    
    // Intercept Tab key to insert spaces
    if (event.key === 'Tab') {
      event.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      // Insert 4 spaces
      const spaces = '    ';
      this.userCode = this.userCode.substring(0, start) + spaces + this.userCode.substring(end);
      this.cdr.detectChanges();

      // Put caret at right position
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + spaces.length;
      }, 0);
    }
  }

  onScroll(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    const lineNumbers = document.querySelector('.editor-line-numbers') as HTMLElement;
    if (lineNumbers && textarea) {
      lineNumbers.scrollTop = textarea.scrollTop;
    }
  }

  runCode() {
    if (this.isExecuting) return;
    this.isExecuting = true;
    this.lastAction = 'run';
    this.runResult = null;
    this.activeConsoleTab = 'result';
    this.cdr.detectChanges();

    this.codeService.runCode(this.userCode, this.selectedLanguage.id, this.stdinInput).subscribe({
      next: (res) => {
        this.runResult = res;
        this.isExecuting = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isExecuting = false;
        console.error('Lỗi chạy thử code:', err);
        alert('Có lỗi xảy ra khi gửi yêu cầu biên dịch.');
        this.cdr.detectChanges();
      }
    });
  }

  submitCode() {
    if (this.isExecuting) return;
    this.isExecuting = true;
    this.lastAction = 'submit';
    this.submissionResult = null;
    this.activeConsoleTab = 'result';
    this.cdr.detectChanges();

    this.codeService.submitCode(this.problemId, this.userCode, this.selectedLanguage.id).subscribe({
      next: (res) => {
        this.submissionResult = res;
        this.isExecuting = false;
        
        // Reload submission list
        this.loadSubmissions();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isExecuting = false;
        console.error('Lỗi nộp bài:', err);
        alert('Có lỗi xảy ra khi nộp bài chấm điểm.');
        this.cdr.detectChanges();
      }
    });
  }

  viewSubmission(subId: string) {
    this.codeService.getSubmissionDetail(subId).subscribe({
      next: (res) => {
        this.selectedSubmission = res;
        this.showSubmissionDetail = true;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi tải chi tiết bài nộp:', err);
        alert('Không thể xem chi tiết bài nộp này.');
      }
    });
  }

  closeSubmissionDetail() {
    this.selectedSubmission = null;
    this.showSubmissionDetail = false;
    this.cdr.detectChanges();
  }

  loadCodeFromSubmission(code: string, languageName: string) {
    if (confirm('Bạn có chắc muốn nạp code cũ này vào trình biên tập hiện tại không?')) {
      const matchLang = this.languages.find(l => l.name.toLowerCase() === languageName.toLowerCase());
      if (matchLang) {
        this.selectedLanguage = matchLang;
      }
      this.userCode = code;
      this.updateLineNumbers();
      this.closeSubmissionDetail();
      this.activeLeftTab = 'description';
    }
  }

  getDifficultyClass(diff: string): string {
    const d = (diff || '').toLowerCase();
    if (d === 'easy') return 'diff-easy';
    if (d === 'medium') return 'diff-medium';
    if (d === 'hard') return 'diff-hard';
    return '';
  }

  getDifficultyLabel(diff: string): string {
    const d = (diff || '').toLowerCase();
    if (d === 'easy') return 'Dễ';
    if (d === 'medium') return 'Trung bình';
    if (d === 'hard') return 'Khó';
    return diff || 'Chưa rõ';
  }

  getVerdictClass(verdict: string): string {
    const v = (verdict || '').toLowerCase();
    if (v === 'accepted' || v === 'ac') return 'verdict-accepted';
    if (v.includes('wrong') || v === 'wa') return 'verdict-wa';
    if (v.includes('compile') || v === 'ce') return 'verdict-ce';
    if (v.includes('time') || v === 'tle') return 'verdict-tle';
    if (v.includes('memory') || v === 'mle') return 'verdict-mle';
    return 'verdict-error';
  }

  getVerdictLabel(verdict: string): string {
    const v = (verdict || '').toLowerCase();
    if (v === 'accepted' || v === 'ac') return 'Accepted (Đã Chấp Nhận)';
    if (v.includes('wrong') || v === 'wa') return 'Wrong Answer (Sai Kết Quả)';
    if (v.includes('compile') || v === 'ce') return 'Compile Error (Lỗi Biên Dịch)';
    if (v.includes('time') || v === 'tle') return 'Time Limit Exceeded (Quá Thời Gian)';
    if (v.includes('memory') || v === 'mle') return 'Memory Limit Exceeded (Quá Bộ Nhớ)';
    return verdict || 'Error';
  }
}
