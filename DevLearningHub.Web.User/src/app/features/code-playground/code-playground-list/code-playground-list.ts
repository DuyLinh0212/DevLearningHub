import { Component, OnInit, inject, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CodeService, ProblemSummary } from '../../../core/services/code.service';
import { ProblemBankService, ProblemBankSummary, ProblemBankDetail } from '../../../core/services/problem-bank.service';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { ReviewStatusBadgeComponent } from '../../../shared/components/review-status-badge/review-status-badge';

type ProblemFormTestCase = {
  id?: string;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
};

@Component({
  selector: 'app-code-playground-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReviewStatusBadgeComponent],
  templateUrl: './code-playground-list.html',
  styleUrl: './code-playground-list.css'
})
export class CodePlaygroundListComponent implements OnInit {
  private codeService = inject(CodeService);
  private bankService = inject(ProblemBankService);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // ---- Tab state ----
  activeTab: 'banks' | 'problems' = 'banks';

  // ---- Problems tab ----
  problems: ProblemSummary[] = [];
  topics: any[] = [];
  completedProblemIds = new Set<string>();
  isLoading = true;
  searchText = '';
  selectedDifficulty = '';
  selectedTopicId = '';
  solvedCount = 0;
  totalCount = 0;

  // ---- Banks tab ----
  banks: ProblemBankSummary[] = [];
  banksLoading = true;
  bankSearchText = '';
  bankMinRating = 0;
  bankSelectedTopicId = '';
  currentUserId = '';

  // ---- Bank detail / manage ----
  selectedBank: ProblemBankDetail | null = null;
  bankDetailLoading = false;
  showBankDetailModal = false;

  // ---- Add Problem to Bank modal ----
  showAddProblemModal = false;
  addProblemBankId = '';
  addProblemSearch = '';
  addProblemLoading = false;

  // ---- Create Bank modal ----
  showCreateBankModal = false;
  isSavingBank = false;
  bankForm = { title: '', description: '', isPublic: true, topicId: '' };
  editingBankId = '';

  // ---- Create Problem modal (existing) ----
  showCreateModal = false;
  isSaving = false;
  selectedLangTab: 'javascript' | 'python' | 'java' | 'cpp' = 'javascript';
  availableLanguages = [
    { id: 1, slug: 'python', name: 'Python' },
    { id: 2, slug: 'javascript', name: 'JavaScript' },
    { id: 3, slug: 'java', name: 'Java' },
    { id: 5, slug: 'cpp', name: 'C++' }
  ];
  selectedLanguageIds: number[] = [1];
  sandbox = { timeLimitMs: 3000, memoryLimitKb: 128000, allowStdin: true };
  importFile: File | null = null;
  importReplaceExisting = false;
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
    testCases: [] as ProblemFormTestCase[]
  };


  get availableTagOptions(): string[] {
    const defaults = ['Algorithm', 'Data Structure', 'String', 'Array', 'Recursion', 'Math', 'Sorting', 'Graph', 'Tree', 'Dynamic Programming'];
    const fromProblems = this.problems.flatMap((p: any) => Array.isArray(p.tags) ? p.tags : []);
    const fromTopics = this.topics.map((t: any) => t.name).filter(Boolean);
    return Array.from(new Set([...defaults, ...fromTopics, ...fromProblems].map((x: any) => String(x).trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }
  // ---- User permissions (removed — ownership-based checks only) ----

  // ---- Edit problem ----
  isEditMode = false;
  editingProblemId = '';
  isLoadingEdit = false;

  // ---- Rating state ----
  ratingHover = 0;

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

  get filteredBanks(): ProblemBankSummary[] {
    const search = this.bankSearchText.trim().toLowerCase();
    return this.banks.filter(b => {
      const matchSearch = !search || b.title.toLowerCase().includes(search) ||
        (b.description || '').toLowerCase().includes(search);
      const matchRating = this.bankMinRating === 0 || b.avgRating >= this.bankMinRating;
      const matchTopic = !this.bankSelectedTopicId ||
        (b.topicId || '').toLowerCase() === this.bankSelectedTopicId.toLowerCase();
      return matchSearch && matchRating && matchTopic;
    });
  }

  selectBankTopic(topicId: string) {
    this.bankSelectedTopicId = topicId;
    this.cdr.detectChanges();
  }

  getBankCountForTopic(topicId: string): number {
    return this.banks.filter(b =>
      (b.topicId || '').toLowerCase() === topicId.toLowerCase()
    ).length;
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
    this.loadCurrentUser();
    this.loadData();
    this.loadBanks();
    this.loadProgrammingLanguages();

    // Support ?bankId= query param to open bank directly
    this.route.queryParams.subscribe(params => {
      if (params['bankId']) {
        this.activeTab = 'banks';
        this.cdr.detectChanges();
      }
    });
  }

  canManageBank(bank: ProblemBankSummary | ProblemBankDetail): boolean {
    return this.isMyBank(bank);
  }

  canEditProblem(problem: ProblemSummary): boolean {
    return this.isMyProblem(problem);
  }

  private loadCurrentUser() {
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    if (!token) return;
    this.http.get<any>('/api/users/me').subscribe({
      next: (res) => {
        const u = res?.data || res;
        this.currentUserId = (u?.id || '').toString().toLowerCase();
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  // ---- Problems tab ----

  loadData() {
    this.isLoading = true;
    this.cdr.detectChanges();
    forkJoin({
      problems: this.codeService.getProblems({ mine: true }),
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
          problems: this.codeService.getProblems({ mine: true }),
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
          error: () => { this.isLoading = false; this.cdr.detectChanges(); }
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

  isMyProblem(problem: ProblemSummary): boolean {
    return (problem.createdBy || '').toLowerCase() === this.currentUserId;
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

  // ---- Banks tab ----

  loadBanks() {
    this.banksLoading = true;
    this.bankService.getBanks().subscribe({
      next: (res) => {
        const data = res?.data || res;
        this.banks = Array.isArray(data) ? data : [];
        this.banksLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.banksLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  isMyBank(bank: ProblemBankSummary): boolean {
    return (bank.creator?.id || '').toLowerCase() === this.currentUserId;
  }

  getStars(rating: number): number[] {
    return [1, 2, 3, 4, 5];
  }

  toggleLike(bank: ProblemBankSummary, event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.bankService.toggleLike(bank.id).subscribe({
      next: (res) => {
        const d = res?.data || res;
        bank.myLiked = d.liked;
        bank.likeCount = d.likeCount;
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  openBankDetail(bank: ProblemBankSummary) {
    this.bankDetailLoading = true;
    this.showBankDetailModal = true;
    this.selectedBank = null;
    this.cdr.detectChanges();
    this.bankService.getBank(bank.id).pipe(
      finalize(() => {
        this.bankDetailLoading = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (res) => {
        const data = res?.data ?? res;
        this.selectedBank = data && typeof data === 'object' ? data : null;
        if (!this.selectedBank) this.showBankDetailModal = false;
      },
      error: () => {
        this.showBankDetailModal = false;
      }
    });
  }

  closeBankDetail() {
    this.showBankDetailModal = false;
    this.selectedBank = null;
    this.cdr.detectChanges();
  }

  removeProblemFromBank(problemId: string) {
    if (!this.selectedBank) return;
    if (!confirm('Xóa bài tập này khỏi ngân hàng?')) return;
    this.bankService.removeProblem(this.selectedBank.id, problemId).subscribe({
      next: () => {
        if (this.selectedBank) {
          this.selectedBank.problems = this.selectedBank.problems.filter(p => p.problemId !== problemId);
          this.selectedBank.problemCount = this.selectedBank.problems.length;
          this.cdr.detectChanges();
        }
      },
      error: () => {}
    });
  }

  openAddProblemModal(bankId: string, event: Event) {
    event.stopPropagation();
    const bank = this.banks.find(b => b.id === bankId);
    if (bank && !this.canManageBank(bank)) {
      return;
    }
    this.addProblemBankId = bankId;
    this.addProblemSearch = '';
    this.showAddProblemModal = true;
    this.cdr.detectChanges();
  }

  closeAddProblemModal() {
    this.showAddProblemModal = false;
    this.cdr.detectChanges();
  }

  get filteredAddProblems(): ProblemSummary[] {
    const search = this.addProblemSearch.trim().toLowerCase();
    // Ownership-based: only show the user's own problems for adding to banks.
    const source = this.problems.filter(p => this.isMyProblem(p));
    if (!search) return source.slice(0, 20);
    return source.filter(p => p.title.toLowerCase().includes(search)).slice(0, 20);
  }

  isProblemInBank(problemId: string): boolean {
    return this.selectedBank?.problems?.some(p => p.problemId === problemId) ?? false;
  }

  addProblemToBank(problem: ProblemSummary) {
    if (!this.addProblemBankId) return;
    this.addProblemLoading = true;
    this.bankService.addProblem(this.addProblemBankId, problem.id).subscribe({
      next: () => {
        this.addProblemLoading = false;
        this.showAddProblemModal = false;
        // Refresh bank detail if open
        if (this.selectedBank && this.selectedBank.id === this.addProblemBankId) {
          this.openBankDetail(this.selectedBank);
        }
        this.loadBanks();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.addProblemLoading = false;
        alert(err?.error?.message || 'Không thể thêm bài tập.');
        this.cdr.detectChanges();
      }
    });
  }

  deleteBank(bank: ProblemBankSummary, event: Event) {
    event.preventDefault();
    event.stopPropagation();
    if (!confirm(`Xóa ngân hàng "${bank.title}"?`)) return;
    this.bankService.deleteBank(bank.id).subscribe({
      next: () => {
        this.banks = this.banks.filter(b => b.id !== bank.id);
        this.cdr.detectChanges();
      },
      error: () => alert('Không thể xóa ngân hàng.')
    });
  }

  // ---- Create / Edit Bank modal ----

  openCreateBankModal(bank?: ProblemBankSummary) {
    const hasToken = typeof window !== 'undefined' && Boolean(localStorage.getItem('accessToken') || localStorage.getItem('token'));
    if (!hasToken) {
      alert('Vui lòng đăng nhập để thực hiện thao tác này!');
      this.router.navigate(['/login']);
      return;
    }
    if (bank) {
      this.editingBankId = bank.id;
      this.bankForm = { title: bank.title, description: bank.description || '', isPublic: bank.isPublic, topicId: bank.topicId || '' };
    } else {
      this.editingBankId = '';
      this.bankForm = { title: '', description: '', isPublic: true, topicId: '' };
    }
    this.showCreateBankModal = true;
    this.cdr.detectChanges();
  }

  closeCreateBankModal() {
    if (this.isSavingBank) return;
    this.showCreateBankModal = false;
    this.cdr.detectChanges();
  }

  saveBankForm() {
    if (!this.bankForm.title.trim()) { alert('Vui lòng nhập tên ngân hàng.'); return; }
    this.isSavingBank = true;
    this.cdr.detectChanges();

    const payload = {
      title: this.bankForm.title.trim(),
      description: this.bankForm.description.trim() || undefined,
      isPublic: this.bankForm.isPublic,
      topicId: this.bankForm.topicId || null
    };

    const req = this.editingBankId
      ? this.bankService.updateBank(this.editingBankId, payload)
      : this.bankService.createBank(payload);

    req.pipe(
      finalize(() => {
        this.isSavingBank = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: () => {
        this.showCreateBankModal = false;
        this.loadBanks();
      },
      error: (err) => {
        alert(err?.error?.message || 'Không thể lưu ngân hàng.');
      }
    });
  }

  // ---- Rate bank ----

  submitRating(bank: ProblemBankSummary, rating: number) {
    this.bankService.rateBank(bank.id, rating).subscribe({
      next: (res) => {
        const d = res?.data || res;
        bank.myRating = rating;
        bank.avgRating = d.avgRating ?? bank.avgRating;
        bank.ratingCount = d.ratingCount ?? bank.ratingCount;
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  // ---- Create Problem modal (existing) ----

  openCreateModal() {
    const hasToken = typeof window !== 'undefined' && Boolean(localStorage.getItem('accessToken') || localStorage.getItem('token'));
    if (!hasToken) {
      alert('Vui lòng đăng nhập để thực hiện thao tác này!');
      this.router.navigate(['/login']);
      return;
    }
    this.isEditMode = false;
    this.editingProblemId = '';
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
    this.selectedLanguageIds = [this.availableLanguages[0]?.id || 1];
    this.sandbox = { timeLimitMs: 3000, memoryLimitKb: 128000, allowStdin: true };
    this.showCreateModal = true;
    this.cdr.detectChanges();
  }

  openEditModal(problem: ProblemSummary) {
    this.isLoadingEdit = true;
    this.cdr.detectChanges();
    this.http.get<any>(`/api/problems/${problem.id}`).subscribe({
      next: (res) => {
        const detail = res?.data || res;
        let sc = { javascript: '', python: '', java: '', cpp: '' };
        if (detail.starterCode) {
          try { sc = { ...sc, ...JSON.parse(detail.starterCode) }; }
          catch { sc.javascript = detail.starterCode; }
        }
        this.isEditMode = true;
        this.editingProblemId = problem.id;
        this.form = {
          title: detail.title || '',
          description: detail.description || '',
          difficulty: detail.difficulty || 'easy',
          topicId: detail.topicId || '',
          isPublished: detail.isActive || false,
          tags: detail.tags || [],
          starterCode: sc,
          testCases: [{ input: '', expectedOutput: '', isHidden: false }]
        };
        this.selectedLanguageIds = detail.languageIds || [this.availableLanguages[0]?.id || 1];
        this.sandbox = detail.sandbox || { timeLimitMs: 3000, memoryLimitKb: 128000, allowStdin: true };
        this.tagInput = '';
        this.selectedLangTab = 'javascript';
        this.loadTestCasesForEdit(problem.id);
        this.isLoadingEdit = false;
        this.showCreateModal = true;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoadingEdit = false;
        alert('Không thể tải chi tiết bài tập để chỉnh sửa.');
        this.cdr.detectChanges();
      }
    });
  }

  private loadTestCasesForEdit(problemId: string) {
    this.http.get<any>(`/api/problems/${problemId}/test-cases`).subscribe({
      next: (res) => {
        const data = res?.data || res;
        const testCases = Array.isArray(data) ? data : [];
        if (testCases.length > 0) {
          this.form.testCases = testCases.map((tc: any) => ({
            id: tc.id,
            input: tc.input || '',
            expectedOutput: tc.expectedOutput || '',
            isHidden: tc.isHidden || false
          }));
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi tải test cases khi chỉnh sửa:', err);
        // Keep default empty test case if load fails
      }
    });
  }

  closeCreateModal() {
    if (this.isSaving) return;
    this.showCreateModal = false;
    this.isEditMode = false;
    this.editingProblemId = '';
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
    if (!this.form.title.trim()) { alert('Vui lòng nhập tên bài tập.'); return; }
    if (!this.form.topicId) { alert('Vui lòng chọn chủ đề cho bài tập.'); return; }

    this.isSaving = true;
    this.cdr.detectChanges();

    const payload = {
      topicId: this.form.topicId,
      title: this.form.title.trim(),
      description: this.form.description.trim(),
      difficulty: this.form.difficulty,
      starterCode: JSON.stringify(this.form.starterCode),
      starterCodes: this.form.starterCode,
      languageIds: this.selectedLanguageIds,
      sandbox: this.sandbox,
      isActive: this.form.isPublished,
      tagIds: [] as string[]
    };

    const validTestCases = this.getValidTestCases();

    if (this.isEditMode && this.editingProblemId) {
      this.http.put(`/api/problems/${this.editingProblemId}`, payload).subscribe({
        next: () => this.syncTestCases(this.editingProblemId, validTestCases),
        error: (err) => {
          this.isSaving = false;
          const msg = err?.error?.message || err?.error?.title || 'Không thể cập nhật bài tập.';
          alert(msg);
          this.cdr.detectChanges();
        }
      });
      return;
    }

    this.http.post('/api/problems', payload, { observe: 'response' }).subscribe({
      next: (res) => {
        const newId = this.extractProblemId(res);

        if (newId && validTestCases.length > 0) {
          this.syncTestCases(newId, validTestCases);
        } else {
          this.finishCreate();
        }
      },
      error: (err) => {
        this.isSaving = false;
        const msg = err?.error?.message || err?.error?.title || 'Không thể tạo bài tập.';
        alert(msg);
        this.cdr.detectChanges();
      }
    });
  }

  private loadProgrammingLanguages() {
    this.http.get<any[]>('/api/programming-languages').subscribe({
      next: (languages) => {
        if (!Array.isArray(languages) || languages.length === 0) return;
        this.availableLanguages = languages.map((l: any) => ({ id: l.id, slug: l.slug, name: l.name }));
        this.selectedLanguageIds = [this.availableLanguages[0].id];
        this.cdr.detectChanges();
      }
    });
  }

  toggleLanguage(id: number) {
    this.selectedLanguageIds = this.selectedLanguageIds.includes(id)
      ? this.selectedLanguageIds.filter(x => x !== id)
      : [...this.selectedLanguageIds, id];
    if (this.selectedLanguageIds.length === 0) this.selectedLanguageIds = [id];
  }

  onImportFile(event: Event) {
    const input = event.target as HTMLInputElement;
    this.importFile = input.files?.[0] || null;
  }

  importTestCases(problemId: string) {
    if (!this.importFile) return;
    const body = new FormData();
    body.append('file', this.importFile);
    body.append('replaceExisting', String(this.importReplaceExisting));
    this.http.post(`/api/problems/${problemId}/test-cases/import`, body).subscribe({
      next: () => { this.importFile = null; this.loadTestCasesForEdit(problemId); alert('Đã import testcase.'); },
      error: err => alert(err?.error?.message || 'Import testcase thất bại.')
    });
  }

  private getValidTestCases(): ProblemFormTestCase[] {
    return this.form.testCases
      .map(tc => ({
        ...tc,
        input: tc.input.trim(),
        expectedOutput: tc.expectedOutput.trim()
      }))
      .filter(tc => tc.input || tc.expectedOutput);
  }

  private extractProblemId(res: any): string | null {
    const body = res?.body?.data || res?.body;
    const bodyId = body?.id || body?.problemId;
    if (bodyId) return bodyId;

    const location: string = res?.headers?.get('Location') || '';
    const parts = location.split('/').filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : null;
  }

  private syncTestCases(problemId: string, testCases: ProblemFormTestCase[]) {
    this.http.get<any>(`/api/problems/${problemId}/test-cases`).subscribe({
      next: (res) => {
        const existing = Array.isArray(res?.data || res) ? (res?.data || res) : [];
        const keptIds = new Set(testCases.filter(tc => tc.id).map(tc => tc.id!.toLowerCase()));
        const requests = [
          ...testCases.map((tc, i) => {
            const payload = {
              input: tc.input,
              expectedOutput: tc.expectedOutput,
              isHidden: tc.isHidden,
              orderIndex: i
            };
            return tc.id
              ? this.http.put(`/api/test-cases/${tc.id}`, payload)
              : this.http.post(`/api/problems/${problemId}/test-cases`, payload);
          }),
          ...existing
            .filter((tc: any) => tc.id && !keptIds.has(tc.id.toLowerCase()))
            .map((tc: any) => this.http.delete(`/api/test-cases/${tc.id}`))
        ];

        if (requests.length === 0) {
          this.finishCreate();
          return;
        }

        forkJoin(requests).subscribe({
          next: () => this.finishCreate(),
          error: (err) => this.handleSaveError(err, 'Không thể lưu test cases.')
        });
      },
      error: (err) => this.handleSaveError(err, 'Không thể tải test cases hiện tại để cập nhật.')
    });
  }

  private handleSaveError(err: any, fallback: string) {
    this.isSaving = false;
    const msg = err?.error?.message || err?.error?.title || fallback;
    alert(msg);
    this.cdr.detectChanges();
  }

  private finishCreate() {
    this.isSaving = false;
    this.showCreateModal = false;
    this.isEditMode = false;
    this.editingProblemId = '';
    this.loadData();
    this.cdr.detectChanges();
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.showBankDetailModal) { this.closeBankDetail(); return; }
    if (this.showAddProblemModal) { this.closeAddProblemModal(); return; }
    if (this.showCreateBankModal && !this.isSavingBank) { this.closeCreateBankModal(); return; }
    if (this.showCreateModal && !this.isSaving) { this.closeCreateModal(); }
  }
}

