import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
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
  filteredProblems: ProblemSummary[] = [];
  topics: any[] = [];
  completedProblemIds = new Set<string>();
  isLoading = true;

  searchText = '';
  selectedDifficulty = '';
  selectedTopicId = '';

  // Stats
  solvedCount = 0;
  totalCount = 0;

  get solvedPercent(): number {
    if (this.totalCount === 0) return 0;
    return Math.round((this.solvedCount / this.totalCount) * 100);
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
        // Topics mapping
        const topicsData = topics?.data || topics;
        this.topics = Array.isArray(topicsData) ? topicsData : [];

        // Problems mapping
        this.problems = problems || [];
        this.totalCount = this.problems.length;

        // Submissions & Progress — compare case-insensitive
        this.completedProblemIds.clear();
        const subs = submissions || [];
        subs.forEach((s: any) => {
          if ((s.verdict || '').toLowerCase() === 'accepted') {
            this.completedProblemIds.add(s.problemId.toLowerCase());
          }
        });
        this.solvedCount = this.completedProblemIds.size;

        this.applyFilters();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi tải dữ liệu Code Playground:', err);
        // Nếu submissions fail (401), vẫn thử tải problems và topics riêng
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
            this.applyFilters();
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

  applyFilters() {
    const search = this.searchText.trim().toLowerCase();
    this.filteredProblems = this.problems.filter(p => {
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
}
