import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CodeService, ProblemDetail, SubmissionSummary, SubmissionDetail } from '../../../core/services/code.service';
import { ForumService } from '../../../core/services/forum.service';
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
  private sanitizer = inject(DomSanitizer);
  private forumService = inject(ForumService);

  problemId = '';
  problem: ProblemDetail | null = null;
  parsedDescription: SafeHtml = '';
  parsedEditorial: SafeHtml = '';
  parsedSolutions: SafeHtml = '';
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
  lineCountArr: number[] = [1];
  fontSize = 14;

  // Tabs control
  activeLeftTab: 'description' | 'editorial' | 'solutions' | 'submissions' = 'description';
  activeConsoleTab: 'testcase' | 'result' = 'testcase';
  isSolved = false;

  // LeetCode Feature Parity Mock Stats & Interactive variables
  likes = 0;
  dislikes = 0;
  isLiked = false;
  isDisliked = false;
  
  acceptedStr = '';
  totalSubsStr = '';
  acceptanceRate = '';
  
  showTopics = false;
  showCompanies = false;
  activeHintIndex: number | null = null;
  companies: string[] = [];
  hints: string[] = [];
  discussionCount = 0;

  feedbackVoted = false;
  feedbackSelection: 'yes' | 'no' | null = null;
  feedbackYesPercent = 50;
  feedbackNoPercent = 50;

  streakCount = 3;
  dccCompleted = false;

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

        // Parse markdown description to safe HTML
        this.parsedDescription = this.sanitizer.bypassSecurityTrustHtml(
          this.parseMarkdown(res.description || '')
        );

        // Generate dynamic editorial and solution content
        this.generateEditorialAndSolutions(res.title || '');

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

  voteFeedback(type: 'yes' | 'no') {
    if (this.feedbackVoted) return;
    this.feedbackSelection = type;
    this.feedbackVoted = true;
    
    if (type === 'yes') {
      const currentYesCount = Math.round(this.feedbackYesPercent * 5);
      const total = 500;
      this.feedbackYesPercent = Math.round(((currentYesCount + 1) / (total + 1)) * 100);
      this.feedbackNoPercent = 100 - this.feedbackYesPercent;
    } else {
      const currentNoCount = Math.round(this.feedbackNoPercent * 5);
      const total = 500;
      this.feedbackNoPercent = Math.round(((currentNoCount + 1) / (total + 1)) * 100);
      this.feedbackYesPercent = 100 - this.feedbackNoPercent;
    }
    this.cdr.detectChanges();
  }

  toggleAccordion(type: 'topics' | 'companies' | 'hints') {
    if (type === 'topics') {
      this.showTopics = !this.showTopics;
    } else if (type === 'companies') {
      this.showCompanies = !this.showCompanies;
    }
    this.cdr.detectChanges();
  }

  toggleHint(idx: number) {
    if (this.activeHintIndex === idx) {
      this.activeHintIndex = null;
    } else {
      this.activeHintIndex = idx;
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

    // Acceptance rate
    let baseRate = 50;
    if (difficulty.toLowerCase() === 'easy') baseRate = 78;
    else if (difficulty.toLowerCase() === 'hard') baseRate = 22;

    const rateOffset = (hash % 14) - 7; // -7 to +7
    const finalRate = baseRate + rateOffset;
    this.acceptanceRate = finalRate.toFixed(1) + '%';

    const totalSubs = (hash % 80000) + 10000;
    const accepted = Math.floor(totalSubs * finalRate / 100);

    this.acceptedStr = this.formatNumber(accepted);
    this.totalSubsStr = this.formatNumber(totalSubs);

    // Discussion count
    this.discussionCount = (hash % 180) + 12;

    // Companies
    const allCompanies = ['Google', 'Meta', 'Amazon', 'Microsoft', 'Apple', 'Uber', 'Bloomberg', 'TikTok', 'Adobe'];
    const companyCount = (hash % 3) + 2; // 2 to 4 companies
    this.companies = [];
    for (let i = 0; i < companyCount; i++) {
      const compIndex = (hash + i) % allCompanies.length;
      const compName = allCompanies[compIndex];
      if (!this.companies.includes(compName)) {
        this.companies.push(compName);
      }
    }

    // Hints
    this.hints = [];
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('tính tổng') || lowerTitle.includes('sum') || lowerTitle.includes('hai số')) {
      this.hints.push("Đọc trực tiếp các giá trị đầu vào từ luồng vào tiêu chuẩn (stdin).");
      this.hints.push("Sử dụng kiểu dữ liệu số nguyên đủ lớn (như `long long` trong C++ hoặc `long` trong Java) để tránh lỗi tràn số khi tính tổng các số cực lớn.");
    } else if (lowerTitle.includes('hello')) {
      this.hints.push("Đảm bảo in chính xác chuỗi 'Hello World!' bao gồm cả dấu chấm than ở cuối.");
      this.hints.push("Hãy chắc chắn rằng không in thừa bất kỳ ký tự khoảng trắng hay ký tự xuống dòng nào không cần thiết.");
    } else if (lowerTitle.includes('lớn nhất') || lowerTitle.includes('max') || lowerTitle.includes('mảng')) {
      this.hints.push("Khởi tạo biến lưu giá trị cực đại tạm thời bằng phần tử đầu tiên của mảng.");
      this.hints.push("Duyệt qua các phần tử tiếp theo từ chỉ số 1 đến N-1 và cập nhật biến cực đại nếu tìm thấy phần tử có giá trị lớn hơn.");
    } else {
      this.hints.push("Hãy mô tả giải thuật của bạn bằng mã giả trước khi bắt đầu viết mã nguồn thực tế.");
      this.hints.push("Xem xét kỹ các ràng buộc về bộ nhớ và thời gian (Time Limit & Memory Limit) trong đề bài.");
    }

    // Reset feedback survey state for this problem
    this.feedbackVoted = false;
    this.feedbackSelection = null;
    const yesVotes = (hash % 300) + 100;
    const noVotes = (hash % 80) + 10;
    const totalVotes = yesVotes + noVotes;
    this.feedbackYesPercent = Math.round((yesVotes / totalVotes) * 100);
    this.feedbackNoPercent = 100 - this.feedbackYesPercent;
  }

  private formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
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

  generateEditorialAndSolutions(title: string) {
    const lowerTitle = title.toLowerCase();
    let editorialMarkdown = '';
    let solutionsMarkdown = '';

    if (lowerTitle.includes('tính tổng') || lowerTitle.includes('sum') || lowerTitle.includes('hai số') || lowerTitle.includes('two sum')) {
      editorialMarkdown = `
### Hướng tiếp cận Two Sum / Tính tổng hai số

Bài toán yêu cầu tìm hai số trong mảng sao cho tổng của chúng bằng một giá trị \`target\` cho trước.

#### Cách 1: Vét cạn (Brute Force)
Sử dụng 2 vòng lặp lồng nhau để duyệt qua mọi cặp phần tử \`(i, j)\`.
- **Độ phức tạp thời gian:** \`O(N^2)\`
- **Độ phức tạp không gian:** \`O(1)\`

#### Cách 2: Sử dụng Bảng băm (Hash Map) - Tối ưu
Ta duyệt qua mảng một lần. Với mỗi phần tử \`x\`, ta kiểm tra xem \`target - x\` đã tồn tại trong bảng băm chưa:
1. Nếu có, ta đã tìm thấy cặp số thỏa mãn.
2. Nếu không, ta đưa \`x\` và chỉ số của nó vào bảng băm.
- **Độ phức tạp thời gian:** \`O(N)\`
- **Độ phức tạp không gian:** \`O(N)\`
      `;

      solutionsMarkdown = `
Dưới đây là lời giải mẫu bằng Python và C++ sử dụng phương pháp Hash Map:

#### Python 3
\`\`\`python
class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        hashmap = {}
        for i, num in enumerate(nums):
            complement = target - num
            if complement in hashmap:
                return [hashmap[complement], i]
            hashmap[num] = i
\`\`\`

#### C++
\`\`\`cpp
#include <vector>
#include <unordered_map>

class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> hashmap;
        for (int i = 0; i < nums.size(); ++i) {
            int complement = target - nums[i];
            if (hashmap.count(complement)) {
                return {hashmap[complement], i};
            }
            hashmap[nums[i]] = i;
        }
        return {};
    }
};
\`\`\`
      `;
    } else if (lowerTitle.includes('concatenation') || lowerTitle.includes('ghép mảng') || lowerTitle.includes('nhân đôi')) {
      editorialMarkdown = `
### Ghép hai mảng / Concatenation of Array

Bài toán yêu cầu tạo ra mảng \`ans\` có độ dài \`2n\` từ mảng đầu vào \`nums\` có độ dài \`n\` sao cho \`ans[i] == nums[i]\` và \`ans[i + n] == nums[i]\`.

#### Giải pháp
Chúng ta chỉ cần duyệt qua mảng \`nums\` một lần từ \`0\` đến \`n - 1\`. Với mỗi chỉ số \`i\`:
- Gán \`ans[i] = nums[i]\`
- Gán \`ans[i + n] = nums[i]\`

Hoặc đơn giản hơn, trong các ngôn ngữ có hỗ trợ nối mảng (như Python hay JS), chúng ta chỉ cần thực hiện phép nhân bản mảng (ví dụ: \`nums + nums\` trong Python, hoặc \`[...nums, ...nums]\` trong JS).

- **Độ phức tạp thời gian:** \`O(N)\`
- **Độ phức tạp không gian:** \`O(N)\` để lưu mảng kết quả.
      `;

      solutionsMarkdown = `
Dưới đây là các giải pháp ngắn gọn bằng các ngôn ngữ khác nhau:

#### JavaScript
\`\`\`javascript
var getConcatenation = function(nums) {
    return [...nums, ...nums];
};
\`\`\`

#### Python 3
\`\`\`python
class Solution:
    def getConcatenation(self, nums: List[int]) -> List[int]:
        return nums * 2
\`\`\`

#### C++
\`\`\`cpp
class Solution {
public:
    vector<int> getConcatenation(vector<int>& nums) {
        int n = nums.size();
        vector<int> ans(2 * n);
        for (int i = 0; i < n; ++i) {
            ans[i] = nums[i];
            ans[i + n] = nums[i];
        }
        return ans;
    }
};
\`\`\`
      `;
    } else if (lowerTitle.includes('hello') || lowerTitle.includes('xin chào')) {
      editorialMarkdown = `
### Xin chào thế giới / Hello World

Bài toán cơ bản nhất để kiểm tra khả năng xuất dữ liệu ra thiết bị đầu ra tiêu chuẩn (stdout).

#### Giải pháp
In ra chuỗi chữ \`Hello World!\` hoặc \`Hello, World!\` tùy theo đề bài yêu cầu. Hãy chú ý đến từng ký tự viết hoa, viết thường và dấu câu.

- **Độ phức tạp thời gian:** \`O(1)\`
- **Độ phức tạp không gian:** \`O(1)\`
      `;

      solutionsMarkdown = `
#### Python 3
\`\`\`python
print("Hello World!")
\`\`\`

#### JavaScript
\`\`\`javascript
console.log("Hello World!");
\`\`\`

#### C++
\`\`\`cpp
#include <iostream>
using namespace std;

int main() {
    cout << "Hello World!" << endl;
    return 0;
}
\`\`\`
      `;
    } else {
      // Fallback
      editorialMarkdown = `
### Hướng dẫn Giải thuật cho bài toán: ${title}

Bài toán này có thể giải bằng nhiều hướng tiếp cận khác nhau. Dưới đây là phân tích chi tiết:

#### Hướng tiếp cận 1: Duyệt tuyến tính (Linear Scan)
Duyệt qua các phần tử để tìm kết quả. Phù hợp với mảng nhỏ hoặc các cấu trúc dữ liệu đơn giản.
- **Độ phức tạp thời gian:** \`O(N)\`
- **Độ phức tạp không gian:** \`O(1)\`

#### Hướng tiếp cận 2: Chia để trị hoặc Quy hoạch động (Dynamic Programming)
Với các bài toán phức tạp hơn hoặc có các ràng buộc lớn, bạn cần lưu trữ lại kết quả của các bài toán con để tránh tính toán lặp lại.
- **Độ phức tạp thời gian:** \`O(N)\` hoặc \`O(N log N)\`
- **Độ phức tạp không gian:** \`O(N)\`
      `;

      solutionsMarkdown = `
#### Python 3
\`\`\`python
# Giải pháp mẫu chung
def solve(input_data):
    # Xử lý thuật toán tại đây
    result = []
    return result
\`\`\`

#### C++
\`\`\`cpp
#include <iostream>
#include <vector>

using namespace std;

// Giải pháp mẫu chung
void solve() {
    // Viết giải thuật tối ưu tại đây
}
\`\`\`
      `;
    }

    this.parsedEditorial = this.sanitizer.bypassSecurityTrustHtml(this.parseMarkdown(editorialMarkdown));
    this.parsedSolutions = this.sanitizer.bypassSecurityTrustHtml(this.parseMarkdown(solutionsMarkdown));
  }
}
