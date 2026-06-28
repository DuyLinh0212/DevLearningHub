import { Component, OnInit, inject, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CodeService, ProblemSummary } from '../../../core/services/code.service';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-code-playground-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './code-playground-list.html',
  styleUrl: './code-playground-list.css'
})
export class CodePlaygroundListComponent implements OnInit {
  private codeService = inject(CodeService);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);

  problems: ProblemSummary[] = [];
  topics: any[] = [];
  completedProblemIds = new Set<string>();
  isLoading = true;

  searchText = '';
  selectedDifficulty = '';
  selectedTopicId = '';

  solvedCount = 0;
  totalCount = 0;

  // Create problem modal state
  showCreateModal = false;
  isSaving = false;
  selectedLangTab: 'javascript' | 'python' | 'java' | 'cpp' = 'javascript';
  tagInput = '';

  form = {
    title: '',
    description: '',
    difficulty: 'easy',
    topicId: '',
    isPublished: false,
    tags: [] as string[],
    starterCode: {
      javascript: '// Write your solution here\nfunction solution(input) {\n  \n}\n',
      python: '# Write your solution here\ndef solution(input):\n    pass\n',
      java: 'import java.util.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        \n    }\n}\n',
      cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}\n'
    },
    testCases: [] as { input: string; expectedOutput: string; isHidden: boolean }[]
  };

  get solvedPercent(): number {
    if (this.totalCount === 0) return 0;
    return Math.round((this.solvedCount / this.totalCount) * 100);
  }

  get filteredProblems(): ProblemSummary[] {
    const search = this.searchText.trim().toLowerCase();
    return this.problems.filter(p => {
      const matchSearch = !search ||
        p.title.toLowerCase().includes(search) ||
        p.tags.some(t => t.toLowerCase().includes(search));
      const matchDiff = !this.selectedDifficulty ||
        p.difficulty.toLowerCase() === this.selectedDifficulty.toLowerCase();
      const matchTopic = !this.selectedTopicId ||
        p.topicId.toLowerCase() === this.selectedTopicId.toLowerCase();
      return matchSearch && matchDiff && matchTopic;
    });
  }

  get selectedTopicName(): string {
    if (!this.selectedTopicId) return 'Tất cả bài tập';
    const t = this.topics.find(t => t.id.toLowerCase() === this.selectedTopicId.toLowerCase());
    return t ? t.name : 'Chủ đề';
  }

  getCountForTopic(topicId: string): number {
    const search = this.searchText.trim().toLowerCase();
    return this.problems.filter(p => {
      const matchSearch = !search ||
        p.title.toLowerCase().includes(search) ||
        p.tags.some(t => t.toLowerCase().includes(search));
      const matchDiff = !this.selectedDifficulty ||
        p.difficulty.toLowerCase() === this.selectedDifficulty.toLowerCase();
      return matchSearch && matchDiff && p.topicId.toLowerCase() === topicId.toLowerCase();
    }).length;
  }

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.isLoading = true;
    this.cdr.detectChanges();

    forkJoin({
      problems: this.codeService.getProblems(),
      topics: this.http.get<any>('/api/topics'),
      submissions: this.codeService.getSubmissions()
    }).subscribe({
      next: ({ problems, topics, submissions }) => {
        const topicsData = topics?.data || topics;
        this.topics = Array.isArray(topicsData) ? topicsData : [];
        this.problems = problems || [];
        this.totalCount = this.problems.length;

        this.completedProblemIds.clear();
        (submissions || []).forEach((s: any) => {
          if ((s.verdict || '').toLowerCase() === 'accepted') {
            this.completedProblemIds.add(s.problemId.toLowerCase());
          }
        });
        this.solvedCount = this.completedProblemIds.size;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        forkJoin({
          problems: this.codeService.getProblems(),
          topics: this.http.get<any>('/api/topics')
        }).subscribe({
          next: ({ problems, topics }) => {
            const topicsData = topics?.data || topics;
            this.topics = Array.isArray(topicsData) ? topicsData : [];
            this.problems = problems || [];
            this.totalCount = this.problems.length;
            this.solvedCount = 0;
            this.isLoading = false;
            this.cdr.detectChanges();
          },
          error: () => {
            this.isLoading = false;
            this.cdr.detectChanges();
          }
        });
      }
    });
  }

  selectTopic(topicId: string) {
    this.selectedTopicId = topicId;
    this.cdr.detectChanges();
  }

  isSolved(problemId: string): boolean {
    return this.completedProblemIds.has(problemId.toLowerCase());
  }

  getDifficultyClass(diff: string): string {
    const d = diff.toLowerCase();
    if (d === 'easy') return 'diff-easy';
    if (d === 'medium') return 'diff-medium';
    if (d === 'hard') return 'diff-hard';
    return '';
  }

  getDifficultyLabel(diff: string): string {
    const d = diff.toLowerCase();
    if (d === 'easy') return 'Dễ';
    if (d === 'medium') return 'Trung bình';
    if (d === 'hard') return 'Khó';
    return diff;
  }

  getTopicName(topicId: string): string {
    const topic = this.topics.find(t => t.id.toLowerCase() === topicId.toLowerCase());
    return topic ? topic.name : 'Khác';
  }

  // ---- Create Problem Modal ----

  openCreateModal() {
    this.form = {
      title: '',
      description: '',
      difficulty: 'easy',
      topicId: this.selectedTopicId || (this.topics[0]?.id || ''),
      isPublished: false,
      tags: [],
      starterCode: {
        javascript: '// Write your solution here\nfunction solution(input) {\n  \n}\n',
        python: '# Write your solution here\ndef solution(input):\n    pass\n',
        java: 'import java.util.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        \n    }\n}\n',
        cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}\n'
      },
      testCases: [{ input: '', expectedOutput: '', isHidden: false }]
    };
    this.tagInput = '';
    this.selectedLangTab = 'javascript';
    this.showCreateModal = true;
    this.cdr.detectChanges();
  }

  closeCreateModal() {
    if (this.isSaving) return;
    this.showCreateModal = false;
    this.cdr.detectChanges();
  }

  addTag() {
    const tag = this.tagInput.trim();
    if (tag && !this.form.tags.includes(tag)) {
      this.form.tags = [...this.form.tags, tag];
    }
    this.tagInput = '';
  }

  removeTag(i: number) {
    this.form.tags = this.form.tags.filter((_, idx) => idx !== i);
  }

  addTestCase() {
    this.form.testCases = [...this.form.testCases, { input: '', expectedOutput: '', isHidden: false }];
  }

  removeTestCase(i: number) {
    if (this.form.testCases.length <= 1) return;
    this.form.testCases = this.form.testCases.filter((_, idx) => idx !== i);
  }

  createProblem() {
    if (!this.form.title.trim()) {
      alert('Vui lòng nhập tên bài tập.');
      return;
    }
    if (!this.form.topicId) {
      alert('Vui lòng chọn chủ đề cho bài tập.');
      return;
    }

    this.isSaving = true;
    this.cdr.detectChanges();

    // starterCode là object {js, python, java, cpp} → serialize thành string để API chấp nhận
    const payload = {
      topicId: this.form.topicId,
      title: this.form.title.trim(),
      description: this.form.description.trim(),
      difficulty: this.form.difficulty,
      starterCode: JSON.stringify(this.form.starterCode),
      tagIds: [] as string[]
    };

    this.http.post('/api/problems', payload, { observe: 'response' }).subscribe({
      next: (res) => {
        // Lấy ID bài tập mới từ Location header: /api/problems/{newGuid}
        const location: string = res.headers?.get('Location') || '';
        const parts = location.split('/');
        const newId = parts[parts.length - 1] || null;

        const validTestCases = this.form.testCases
          .filter(tc => tc.input.trim() || tc.expectedOutput.trim());

        if (newId && validTestCases.length > 0) {
          const tcRequests = validTestCases.map((tc, i) =>
            this.http.post(`/api/problems/${newId}/test-cases`, {
              input: tc.input,
              expectedOutput: tc.expectedOutput,
              isHidden: tc.isHidden,
              orderIndex: i
            })
          );
          forkJoin(tcRequests).subscribe({
            next: () => this.finishCreate(),
            error: () => this.finishCreate()
          });
        } else {
          this.finishCreate();
        }
      },
      error: (err) => {
        this.isSaving = false;
        const msg = err?.error?.message || err?.error?.title || 'Không thể tạo bài tập. Vui lòng thử lại.';
        alert(msg);
        this.cdr.detectChanges();
      }
    });
  }

  private finishCreate() {
    this.isSaving = false;
    this.showCreateModal = false;
    this.loadData();
    this.cdr.detectChanges();
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.showCreateModal && !this.isSaving) this.closeCreateModal();
  }
}
