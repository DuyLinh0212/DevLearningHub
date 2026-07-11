import { Component, OnInit, inject, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CodeService, ProblemDetail, SubmissionSummary, SubmissionDetail } from '../../../core/services/code.service';
import { ForumService } from '../../../core/services/forum.service';
import { ReportService } from '../../../core/services/report.service';
import { RoadmapService } from '../../../core/services/roadmap.service';

interface LanguageOption {
  id: number;
  name: string;
  slug: string;
}

interface SyntaxColors {
  keyword: string; string: string; comment: string; number: string;
  func: string; type: string; preprocessor: string;
  text: string; bg: string; bgAlt: string; caret: string; lineNum: string;
}

interface EditorSettings {
  theme: string;
  colors: SyntaxColors;
}

const EDITOR_THEMES: Record<string, SyntaxColors> = {
  dracula: {
    keyword:'#FF79C6', string:'#F1FA8C', comment:'#6272A4', number:'#BD93F9',
    func:'#50FA7B', type:'#8BE9FD', preprocessor:'#BD93F9',
    text:'#F8F8F2', bg:'#282A36', bgAlt:'#21222C', caret:'#F8F8F2', lineNum:'#6272A4'
  },
  vscode: {
    keyword:'#569CD6', string:'#CE9178', comment:'#6A9955', number:'#B5CEA8',
    func:'#DCDCAA', type:'#4EC9B0', preprocessor:'#C586C0',
    text:'#D4D4D4', bg:'#1E1E1E', bgAlt:'#161616', caret:'#AEAFAD', lineNum:'#858585'
  },
  monokai: {
    keyword:'#F92672', string:'#E6DB74', comment:'#75715E', number:'#AE81FF',
    func:'#A6E22E', type:'#66D9EF', preprocessor:'#F92672',
    text:'#F8F8F2', bg:'#272822', bgAlt:'#1e1f1b', caret:'#F8F8F2', lineNum:'#75715E'
  },
  nord: {
    keyword:'#81A1C1', string:'#A3BE8C', comment:'#4C566A', number:'#B48EAD',
    func:'#88C0D0', type:'#8FBCBB', preprocessor:'#81A1C1',
    text:'#D8DEE9', bg:'#2E3440', bgAlt:'#242933', caret:'#88C0D0', lineNum:'#4C566A'
  },
  light: {
    keyword:'#0070C1', string:'#A31515', comment:'#008000', number:'#098658',
    func:'#795E26', type:'#267F99', preprocessor:'#AF00DB',
    text:'#000000', bg:'#FFFFFF', bgAlt:'#F3F3F3', caret:'#000000', lineNum:'#999999'
  }
};

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
  private sanitizer = inject(DomSanitizer);
  private forumService = inject(ForumService);
  private reportService = inject(ReportService);
  private roadmapService = inject(RoadmapService);

  private roadmapId: string | null = null;
  private roadmapItemId: string | null = null;

  problemId = '';
  problem: ProblemDetail | null = null;
  parsedDescription: SafeHtml = '';
  discussionPostId: string | null = null;
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
  codeSuggestions: string[] = [];
  selectedSuggestionIndex = 0;
  lineCountArr: number[] = [1];
  fontSize = 14;

  // Syntax highlighting & editor settings
  readonly EDITOR_THEMES = EDITOR_THEMES;
  readonly themeKeys = Object.keys(EDITOR_THEMES);
  editorSettings: EditorSettings = this.initSettings();
  showEditorSettings = false;
  highlightedCode: SafeHtml = '';

  // Tabs control
  activeLeftTab: 'description' | 'solutions' | 'submissions' = 'description';
  activeConsoleTab: 'testcase' | 'result' = 'testcase';
  isSolved = false;

  // LeetCode Feature Parity Mock Stats & Interactive variables
  likes = 0;
  dislikes = 0;
  isLiked = false;
  isDisliked = false;

  streakCount = 3;
  dccCompleted = false;

  // Report state
  isReportModalOpen = false;
  reportDescription = '';

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
    this.roadmapId = this.route.snapshot.queryParamMap.get('roadmapId');
    this.roadmapItemId = this.route.snapshot.queryParamMap.get('roadmapItemId');
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

        // Parse markdown description to safe HTML
        this.parsedDescription = this.sanitizer.bypassSecurityTrustHtml(
          this.parseMarkdown(res.description || '')
        );

        // Try to fetch discussion post matching the problem title (fuzzy match)
        if (res.title) {
          this.forumService.getPosts(1, 10, res.title, '').subscribe({
            next: (postRes) => {
              const items = postRes?.items || postRes || [];
              const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9\u00C0-\u024F\u1E00-\u1EFF\s]/g, '');
              const problemTitle = norm(res.title);

              // Tính điểm tương đồng giữa 2 chuỗi (0–100)
              const similarity = (a: string, b: string): number => {
                if (a === b) return 100;
                if (a.includes(b) || b.includes(a)) return 80;
                // Overlap dựa theo từ
                const wordsA = new Set(a.split(/\s+/).filter(Boolean));
                const wordsB = new Set(b.split(/\s+/).filter(Boolean));
                const shared = [...wordsA].filter(w => wordsB.has(w)).length;
                const union = new Set([...wordsA, ...wordsB]).size;
                return union > 0 ? Math.round((shared / union) * 100) : 0;
              };

              // Chọn bài viết có điểm cao nhất, tối thiểu 60%
              let bestMatch: any = null;
              let bestScore = 60; // ngưỡng tối thiểu
              for (const p of items) {
                const score = similarity(problemTitle, norm(p.title || ''));
                if (score > bestScore) {
                  bestScore = score;
                  bestMatch = p;
                }
              }

              this.discussionPostId = bestMatch ? bestMatch.id : null;
              this.cdr.detectChanges();
            },
            error: (err) => {
              console.error('Lỗi tìm kiếm bài viết thảo luận:', err);
              this.discussionPostId = null;
            }
          });
        }

        // Generate deterministic mock stats for LeetCode features
        this.generateProblemMockStats(res.id, res.title, res.difficulty);

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
        this.isSolved = this.submissions.some(s => s.verdict.toLowerCase() === 'accepted');
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
    this.updateHighlight();
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

  onEditorCodeChange() {
    this.updateLineNumbers();
    this.updateHighlight();
    this.updateCodeSuggestions();
  }

  private updateCodeSuggestions() {
    const match = this.userCode.match(/[A-Za-z_][A-Za-z0-9_]*$/);
    if (!match || match[0].length < 2) {
      this.codeSuggestions = [];
      return;
    }
    const prefix = match[0].toLowerCase();
    const byLanguage: Record<string, string[]> = {
      python: ['def ', 'for ', 'if ', 'input(', 'print(', 'return '],
      javascript: ['function ', 'for ', 'if ', 'const ', 'console.log(', 'return '],
      java: ['public class ', 'for ', 'if ', 'System.out.println(', 'return '],
      cpp: ['#include <iostream>', 'for ', 'if ', 'std::cout << ', 'return ']
    };
    this.codeSuggestions = (byLanguage[this.selectedLanguage.slug] || [])
      .filter(item => item.toLowerCase().startsWith(prefix))
      .slice(0, 5);
    this.selectedSuggestionIndex = 0;
  }

  insertCodeSuggestion(suggestion: string) {
    const textarea = document.querySelector('.editor-textarea') as HTMLTextAreaElement | null;
    const match = this.userCode.match(/[A-Za-z_][A-Za-z0-9_]*$/);
    if (!textarea || !match) return;
    const start = textarea.selectionStart - match[0].length;
    const end = textarea.selectionStart;
    this.userCode = this.userCode.substring(0, start) + suggestion + this.userCode.substring(end);
    this.codeSuggestions = [];
    this.cdr.detectChanges();
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + suggestion.length;
    });
  }

  onKeyDown(event: KeyboardEvent) {
    const textarea = event.target as HTMLTextAreaElement;

    if (this.codeSuggestions.length > 0 && (event.key === 'Tab' || event.key === 'Enter')) {
      event.preventDefault();
      this.insertCodeSuggestion(this.codeSuggestions[this.selectedSuggestionIndex]);
      return;
    }
    if (event.key === 'Escape') {
      this.codeSuggestions = [];
      return;
    }
    
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
    const pre = document.querySelector('.highlight-pre') as HTMLElement;
    if (lineNumbers) lineNumbers.scrollTop = textarea.scrollTop;
    if (pre) {
      pre.scrollTop = textarea.scrollTop;
      pre.scrollLeft = textarea.scrollLeft;
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

        if ((res?.verdict || '').toLowerCase() === 'accepted' && this.roadmapId && this.roadmapItemId) {
          this.roadmapService.completeItem(this.roadmapId, this.roadmapItemId).subscribe({
            error: (err) => console.error('Khong the danh dau hoan thanh muc hoc trong lo trinh:', err)
          });
        }

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
      const matchLang = this.languages.find(l => l.name.toLowerCase() === languageName.toLowerCase() || l.slug.toLowerCase() === languageName.toLowerCase());
      if (matchLang) {
        this.selectedLanguage = matchLang;
      }
      this.userCode = code;
      this.updateLineNumbers();
      this.closeSubmissionDetail();
      this.activeLeftTab = 'description';
    }
  }

  openReportModal() {
    this.isReportModalOpen = true;
    this.cdr.detectChanges();
  }

  closeReportModal() {
    this.isReportModalOpen = false;
    this.reportDescription = '';
    this.cdr.detectChanges();
  }

  submitReport() {
    const description = this.reportDescription.trim();
    if (!description) {
      alert('Vui lòng mô tả lỗi bạn gặp phải.');
      return;
    }

    const enrichedDescription = [
      `Bài code: ${this.problem?.title || this.problemId}`,
      description
    ].join('\n');

    this.reportService.createReport('problem', this.problemId, enrichedDescription).subscribe({
      next: () => {
        alert('Cảm ơn bạn! Báo cáo đã được gửi đến người tạo bài code để xem xét.');
        this.closeReportModal();
      },
      error: (err) => {
        alert(err?.error?.message || 'Không thể gửi báo cáo. Vui lòng thử lại sau.');
      }
    });
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

  // LeetCode interactive methods
  toggleLike() {
    if (this.isLiked) {
      this.likes--;
      this.isLiked = false;
    } else {
      this.likes++;
      this.isLiked = true;
      if (this.isDisliked) {
        this.dislikes--;
        this.isDisliked = false;
      }
    }
    this.cdr.detectChanges();
  }

  toggleDislike() {
    if (this.isDisliked) {
      this.dislikes--;
      this.isDisliked = false;
    } else {
      this.dislikes++;
      this.isDisliked = true;
      if (this.isLiked) {
        this.likes--;
        this.isLiked = false;
      }
    }
    this.cdr.detectChanges();
  }

  generateProblemMockStats(problemId: string, title: string, difficulty: string) {
    if (!problemId) return;

    let hash = 0;
    const str = problemId + title;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    hash = Math.abs(hash);

    // Likes & Dislikes
    this.likes = (hash % 1200) + 150;
    this.dislikes = (hash % 80) + 5;
    this.isLiked = false;
    this.isDisliked = false;
  }

  parseMarkdown(text: string): string {
    if (!text) return '';
    let html = text;

    // Escape HTML entities first (prevent XSS from raw html in description)
    html = html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 1. Extract fenced code blocks
    const codeBlocks: string[] = [];
    html = html.replace(/```(\w*)[\r\n]+([\s\S]*?)[\r\n]+```/g, (match, lang, code) => {
      const index = codeBlocks.length;
      codeBlocks.push(`<pre class="code-block-wrapper"><code class="language-${lang}">${code}</code></pre>`);
      return `__CODE_BLOCK_PLACEHOLDER_${index}__`;
    });

    // Headers h1-h4
    html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Bold and italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Markdown table detection
    const lines = html.split('\n');
    const resultLines: string[] = [];
    let inTable = false;
    let tableBuffer: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isTableRow = /^\|(.+\|)+$/.test(line.trim());
      const isSeparator = /^\|[\s\-|:]+\|$/.test(line.trim());

      if (isTableRow || isSeparator) {
        if (!inTable) { inTable = true; tableBuffer = []; }
        tableBuffer.push(line);
      } else {
        if (inTable) {
          // Flush table
          const tableHtml = this.convertMarkdownTable(tableBuffer);
          resultLines.push(tableHtml);
          inTable = false;
          tableBuffer = [];
        }
        resultLines.push(line);
      }
    }
    if (inTable && tableBuffer.length > 0) {
      resultLines.push(this.convertMarkdownTable(tableBuffer));
    }
    html = resultLines.join('\n');

    // Unordered list items
    html = html.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

    // Ordered list items
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    // Horizontal rule
    html = html.replace(/^---+$/gm, '<hr>');

    // Paragraphs: double newlines
    html = html.replace(/\n\n+/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');

    // Wrap in paragraph if not already wrapped
    if (!html.startsWith('<') && !html.startsWith('__CODE_BLOCK_PLACEHOLDER_')) {
      html = '<p>' + html + '</p>';
    }

    // 2. Restore fenced code blocks
    for (let i = 0; i < codeBlocks.length; i++) {
      html = html.replace(`__CODE_BLOCK_PLACEHOLDER_${i}__`, codeBlocks[i]);
    }

    return html;
  }

  private convertMarkdownTable(tableLines: string[]): string {
    if (tableLines.length < 2) return tableLines.join('\n');
    
    let tableHtml = '<table class="md-table"><thead><tr>';
    
    // Header row
    const headerCells = tableLines[0].split('|').filter(c => c.trim() !== '');
    for (const cell of headerCells) {
      tableHtml += `<th>${cell.trim()}</th>`;
    }
    tableHtml += '</tr></thead><tbody>';

    // Body rows (skip separator row at index 1)
    for (let i = 2; i < tableLines.length; i++) {
      const cells = tableLines[i].split('|').filter(c => c.trim() !== '');
      if (cells.length === 0) continue;
      tableHtml += '<tr>';
      for (const cell of cells) {
        tableHtml += `<td>${cell.trim()}</td>`;
      }
      tableHtml += '</tr>';
    }

    tableHtml += '</tbody></table>';
    return tableHtml;
  }

  // ─── Editor Settings ─────────────────────────────────────────────────────────

  private initSettings(): EditorSettings {
    try {
      const saved = localStorage.getItem('cp-editor-settings');
      if (saved) {
        const parsed = JSON.parse(saved) as EditorSettings;
        if (parsed.theme && EDITOR_THEMES[parsed.theme] && parsed.colors) return parsed;
      }
    } catch {}
    return { theme: 'dracula', colors: { ...EDITOR_THEMES['dracula'] } };
  }

  private saveSettings() {
    localStorage.setItem('cp-editor-settings', JSON.stringify(this.editorSettings));
  }

  applyTheme(name: string) {
    if (!EDITOR_THEMES[name]) return;
    this.editorSettings = { theme: name, colors: { ...EDITOR_THEMES[name] } };
    this.saveSettings();
    this.updateHighlight();
    this.cdr.detectChanges();
  }

  onColorChange() {
    this.saveSettings();
    this.updateHighlight();
    this.cdr.detectChanges();
  }

  @HostListener('document:click')
  onDocClick() {
    if (this.showEditorSettings) {
      this.showEditorSettings = false;
      this.cdr.detectChanges();
    }
  }

  toggleEditorSettings(event: Event) {
    event.stopPropagation();
    this.showEditorSettings = !this.showEditorSettings;
    this.cdr.detectChanges();
  }

  stopProp(event: Event) {
    event.stopPropagation();
  }

  // ─── Syntax Highlighter ───────────────────────────────────────────────────────

  updateHighlight() {
    const raw = this.doHighlight(this.userCode, this.selectedLanguage.slug);
    this.highlightedCode = this.sanitizer.bypassSecurityTrustHtml(raw + '\n');
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private tok(color: string, text: string, italic = false): string {
    const s = italic ? `color:${color};font-style:italic` : `color:${color}`;
    return `<span style="${s}">${this.esc(text)}</span>`;
  }

  private doHighlight(code: string, lang: string): string {
    const c = this.editorSettings.colors;
    type Rule = { pattern: RegExp; render: (m: string) => string };

    const rules: Rule[] = [];

    // Block comment
    const blockComment = /\/\*[\s\S]*?\*\//;
    // Line comment variants
    const lineCommentSlash = /\/\/[^\n]*/;
    const lineCommentHash = /#[^\n]*/;
    // Preprocessor (#include etc)
    const preprocessor = /#\s*(?:include|define|pragma|ifdef|ifndef|endif|elif|if|else|undef|error)\b[^\n]*/;
    // Strings
    const tripleStr = /"""[\s\S]*?"""|'''[\s\S]*?'''/;
    const dblStr = /"(?:[^"\\]|\\.)*"/;
    const sglStr = /'(?:[^'\\]|\\.)*'/;
    const tplStr = /`(?:[^`\\]|\\.)*`/;
    // Numbers
    const numHex = /\b0x[0-9a-fA-F]+[uUlL]*/;
    const numDec = /\b\d+\.?\d*(?:[eE][+-]?\d+)?[fFjJuUlLdD]*/;
    // Identifiers (for keywords/types/funcs)
    const ident = /\b[A-Za-z_]\w*/;
    // Function call lookahead
    const funcCall = /\b[A-Za-z_]\w*(?=\s*\()/;

    if (lang === 'python') {
      const KW = new Set(['False','None','True','and','as','assert','async','await','break',
        'class','continue','def','del','elif','else','except','finally','for','from','global',
        'if','import','in','is','lambda','nonlocal','not','or','pass','raise','return','try',
        'while','with','yield']);
      const TY = new Set(['int','str','float','bool','list','dict','tuple','set','bytes','type',
        'object','Exception','BaseException','ValueError','TypeError','KeyError','IndexError',
        'AttributeError','RuntimeError','StopIteration','self','cls','print','len','range',
        'input','open','map','filter','zip','enumerate','sorted','reversed','isinstance',
        'hasattr','getattr','setattr','property','staticmethod','classmethod','super',
        'min','max','sum','abs','round','any','all']);

      rules.push(
        { pattern: new RegExp(lineCommentHash.source, 'g'), render: m => this.tok(c.comment, m, true) },
        { pattern: new RegExp(tripleStr.source, 'g'),       render: m => this.tok(c.string, m) },
        { pattern: new RegExp(dblStr.source, 'g'),          render: m => this.tok(c.string, m) },
        { pattern: new RegExp(sglStr.source, 'g'),          render: m => this.tok(c.string, m) },
        { pattern: new RegExp('@\\w+', 'g'),                render: m => this.tok(c.preprocessor, m) },
        { pattern: new RegExp(numHex.source + '|' + numDec.source, 'g'), render: m => this.tok(c.number, m) },
        { pattern: new RegExp(funcCall.source, 'g'), render: m =>
            KW.has(m) ? this.tok(c.keyword, m) : TY.has(m) ? this.tok(c.type, m) : this.tok(c.func, m) },
        { pattern: new RegExp(ident.source, 'g'), render: m =>
            KW.has(m) ? this.tok(c.keyword, m) : TY.has(m) ? this.tok(c.type, m) : this.esc(m) }
      );
    } else if (lang === 'javascript' || lang === 'typescript') {
      const KW = new Set(['async','await','break','case','catch','class','const','continue',
        'debugger','default','delete','do','else','export','extends','finally','for','from',
        'function','if','import','in','instanceof','let','new','of','return','static','super',
        'switch','this','throw','try','typeof','var','void','while','with','yield']);
      const TY = new Set(['string','number','boolean','any','void','never','object','unknown',
        'null','undefined','true','false','NaN','Infinity','console','Math','JSON','Date',
        'RegExp','Error','Object','Array','String','Number','Boolean','Symbol','Function',
        'Promise','Map','Set','Record','Partial','Required','Readonly','window','document',
        'globalThis','setTimeout','setInterval','clearTimeout','clearInterval','fetch',
        'parseInt','parseFloat','isNaN','isFinite','Omit','Pick','Exclude','Extract',
        'ReturnType','Parameters','NonNullable','Awaited']);

      rules.push(
        { pattern: new RegExp(blockComment.source, 'g'),   render: m => this.tok(c.comment, m, true) },
        { pattern: new RegExp(lineCommentSlash.source, 'g'), render: m => this.tok(c.comment, m, true) },
        { pattern: new RegExp(tplStr.source, 'g'),          render: m => this.tok(c.string, m) },
        { pattern: new RegExp(dblStr.source, 'g'),          render: m => this.tok(c.string, m) },
        { pattern: new RegExp(sglStr.source, 'g'),          render: m => this.tok(c.string, m) },
        { pattern: new RegExp(numHex.source + '|' + numDec.source, 'g'), render: m => this.tok(c.number, m) },
        { pattern: new RegExp(funcCall.source, 'g'), render: m =>
            KW.has(m) ? this.tok(c.keyword, m) : TY.has(m) ? this.tok(c.type, m) : this.tok(c.func, m) },
        { pattern: new RegExp(ident.source, 'g'), render: m =>
            KW.has(m) ? this.tok(c.keyword, m) : TY.has(m) ? this.tok(c.type, m) : this.esc(m) }
      );
    } else if (lang === 'java') {
      const KW = new Set(['abstract','assert','boolean','break','byte','case','catch','char',
        'class','const','continue','default','do','double','else','enum','extends','final',
        'finally','float','for','goto','if','implements','import','instanceof','int','interface',
        'long','native','new','package','private','protected','public','return','short','static',
        'strictfp','super','switch','synchronized','this','throw','throws','transient','try',
        'void','volatile','while','true','false','null']);
      const TY = new Set(['String','Integer','Long','Double','Float','Boolean','Character','Byte',
        'Short','Object','Class','System','Math','Arrays','Collections','List','ArrayList',
        'LinkedList','Map','HashMap','TreeMap','Set','HashSet','TreeSet','Iterator','Exception',
        'RuntimeException','IOException','StringBuilder','StringBuffer','Thread','Runnable',
        'Scanner','BufferedReader','InputStreamReader','PrintWriter','Optional','Stream',
        'Collectors','Objects','var']);

      rules.push(
        { pattern: new RegExp(blockComment.source, 'g'),   render: m => this.tok(c.comment, m, true) },
        { pattern: new RegExp(lineCommentSlash.source, 'g'), render: m => this.tok(c.comment, m, true) },
        { pattern: new RegExp(dblStr.source, 'g'),          render: m => this.tok(c.string, m) },
        { pattern: new RegExp(sglStr.source, 'g'),          render: m => this.tok(c.string, m) },
        { pattern: new RegExp('@\\w+', 'g'),                render: m => this.tok(c.preprocessor, m) },
        { pattern: /\b[A-Z][A-Za-z0-9_]*(?=\s*[(<])/g, render: m => this.tok(c.type, m) },
        { pattern: new RegExp(numHex.source + '|' + numDec.source, 'g'), render: m => this.tok(c.number, m) },
        { pattern: new RegExp(funcCall.source, 'g'), render: m =>
            KW.has(m) ? this.tok(c.keyword, m) : TY.has(m) ? this.tok(c.type, m) : this.tok(c.func, m) },
        { pattern: new RegExp(ident.source, 'g'), render: m =>
            KW.has(m) ? this.tok(c.keyword, m) : TY.has(m) ? this.tok(c.type, m) : this.esc(m) }
      );
    } else if (lang === 'cpp' || lang === 'c') {
      const KW = new Set(['alignas','alignof','asm','auto','bool','break','case','catch','char',
        'class','const','constexpr','const_cast','continue','decltype','default','delete','do',
        'double','dynamic_cast','else','enum','explicit','export','extern','false','float','for',
        'friend','goto','if','inline','int','long','mutable','namespace','new','noexcept',
        'nullptr','operator','private','protected','public','register','reinterpret_cast',
        'return','short','signed','sizeof','static','static_assert','static_cast','struct',
        'switch','template','this','throw','true','try','typedef','typeid','typename','union',
        'unsigned','using','virtual','void','volatile','wchar_t','while']);
      const TY = new Set(['string','vector','map','set','pair','array','deque','list','queue',
        'stack','priority_queue','unordered_map','unordered_set','unique_ptr','shared_ptr',
        'weak_ptr','make_unique','make_shared','cout','cin','cerr','endl','size_t','ptrdiff_t',
        'uint8_t','uint16_t','uint32_t','uint64_t','int8_t','int16_t','int32_t','int64_t',
        'max','min','sort','reverse','find','lower_bound','upper_bound','abs','swap',
        'to_string','stoi','stol','stod','printf','scanf','strlen','strcmp','strcpy','memset',
        'memcpy','NULL','std','ios','ios_base','sync_with_stdio','tie','fixed','setprecision']);

      rules.push(
        { pattern: new RegExp(blockComment.source, 'g'),   render: m => this.tok(c.comment, m, true) },
        { pattern: new RegExp(lineCommentSlash.source, 'g'), render: m => this.tok(c.comment, m, true) },
        { pattern: new RegExp(dblStr.source, 'g'),          render: m => this.tok(c.string, m) },
        { pattern: new RegExp(sglStr.source, 'g'),          render: m => this.tok(c.string, m) },
        { pattern: new RegExp(preprocessor.source, 'g'),   render: m => this.tok(c.preprocessor, m) },
        { pattern: new RegExp(numHex.source + '|' + numDec.source, 'g'), render: m => this.tok(c.number, m) },
        { pattern: new RegExp(funcCall.source, 'g'), render: m =>
            KW.has(m) ? this.tok(c.keyword, m) : TY.has(m) ? this.tok(c.type, m) : this.tok(c.func, m) },
        { pattern: new RegExp(ident.source, 'g'), render: m =>
            KW.has(m) ? this.tok(c.keyword, m) : TY.has(m) ? this.tok(c.type, m) : this.esc(m) }
      );
    }

    if (rules.length === 0) return this.esc(code);

    // Build combined regex: each rule becomes one capturing group
    const combined = new RegExp(rules.map(r => `(${r.pattern.source})`).join('|'), 'g');
    let result = '';
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = combined.exec(code)) !== null) {
      if (match.index > lastIndex) result += this.esc(code.slice(lastIndex, match.index));
      // Find which outer group matched (match[1], match[2], ...)
      for (let i = 0; i < rules.length; i++) {
        if (match[i + 1] !== undefined) {
          result += rules[i].render(match[i + 1]);
          break;
        }
      }
      lastIndex = combined.lastIndex;
      if (combined.lastIndex === match.index) combined.lastIndex++;
    }

    if (lastIndex < code.length) result += this.esc(code.slice(lastIndex));
    return result;
  }

}
