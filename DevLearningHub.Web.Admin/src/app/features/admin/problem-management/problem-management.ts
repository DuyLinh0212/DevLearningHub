import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar';

@Component({
  selector: 'app-problem-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SidebarComponent],
  templateUrl: './problem-management.html',
  styleUrl: './problem-management.css'
})
export class ProblemManagementComponent implements OnInit {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);

  problems: any[] = [];
  filteredProblems: any[] = [];
  topics: any[] = [];
  isLoading = true;

  searchText = '';
  selectedDifficulty = '';
  selectedTopicId = '';

  // Form State
  isModalOpen = false;
  isEditing = false;
  editingProblemId = '';
  form = {
    topicId: '',
    title: '',
    description: '',
    difficulty: 'easy',
    starterCode: ''
  };

  ngOnInit() {
    this.loadTopics();
    this.loadProblems();
  }

  loadTopics() {
    this.http.get<any>('/api/topics').subscribe({
      next: (res) => {
        const data = res?.data || res;
        this.topics = Array.isArray(data) ? data : [];
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Lỗi tải topics:', err)
    });
  }

  loadProblems() {
    this.isLoading = true;
    this.http.get<any>('/api/problems').subscribe({
      next: (res) => {
        const data = res?.data || res;
        this.problems = Array.isArray(data) ? data : [];
        this.filterProblems();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi tải danh sách bài tập:', err);
        this.isLoading = false;
        this.problems = [];
        this.filteredProblems = [];
        this.cdr.detectChanges();
      }
    });
  }

  filterProblems() {
    const search = this.searchText.trim().toLowerCase();
    this.filteredProblems = this.problems.filter(p => {
      const matchSearch = !search || p.title?.toLowerCase().includes(search);
      const matchDiff = !this.selectedDifficulty || p.difficulty?.toLowerCase() === this.selectedDifficulty.toLowerCase();
      const matchTopic = !this.selectedTopicId || p.topicId?.toLowerCase() === this.selectedTopicId.toLowerCase();
      return matchSearch && matchDiff && matchTopic;
    });
  }

  openModal(problem: any = null) {
    if (problem) {
      this.isEditing = true;
      this.editingProblemId = problem.id;
      // Get detailed problem info to fetch the description and starter code
      this.isLoading = true;
      this.cdr.detectChanges();
      
      this.http.get<any>(`/api/problems/${problem.id}`).subscribe({
        next: (res) => {
          const detail = res?.data || res;
          this.form = {
            topicId: detail.topicId || '',
            title: detail.title || '',
            description: detail.description || '',
            difficulty: detail.difficulty || 'easy',
            starterCode: detail.starterCode || ''
          };
          this.isModalOpen = true;
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error(err);
          this.isLoading = false;
          alert('Không thể tải chi tiết bài tập để chỉnh sửa.');
          this.cdr.detectChanges();
        }
      });
    } else {
      this.isEditing = false;
      this.editingProblemId = '';
      this.form = {
        topicId: this.topics[0]?.id || '',
        title: '',
        description: '',
        difficulty: 'easy',
        starterCode: ''
      };
      this.isModalOpen = true;
      this.cdr.detectChanges();
    }
  }

  closeModal() {
    this.isModalOpen = false;
    this.cdr.detectChanges();
  }

  saveProblem() {
    if (!this.form.title.trim() || !this.form.description.trim()) {
      alert('Vui lòng nhập đầy đủ Tên bài tập và Mô tả đề bài.');
      return;
    }

    const payload = {
      ...this.form,
      title: this.form.title.trim(),
      description: this.form.description.trim(),
      starterCode: this.form.starterCode ? this.form.starterCode.trim() : null
    };

    const req$ = this.isEditing
      ? this.http.put<any>(`/api/problems/${this.editingProblemId}`, payload)
      : this.http.post<any>('/api/problems', payload);

    req$.subscribe({
      next: () => {
        alert(this.isEditing ? 'Cập nhật bài tập thành công!' : 'Tạo bài tập mới thành công!');
        this.closeModal();
        this.loadProblems();
      },
      error: (err) => {
        console.error('Lỗi lưu bài tập:', err);
        alert(err?.error?.message || 'Có lỗi xảy ra khi lưu bài tập.');
      }
    });
  }

  deleteProblem(id: string) {
    if (!confirm('Bạn có chắc chắn muốn xóa bài tập này? (Xóa mềm, chuyển trạng thái hoạt động về false)')) return;
    this.http.delete<any>(`/api/problems/${id}`).subscribe({
      next: () => {
        alert('Xóa bài tập thành công!');
        this.loadProblems();
      },
      error: (err) => {
        console.error(err);
        alert('Không thể xóa bài tập này.');
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
    return diff;
  }

  getTopicName(topicId: string): string {
    const topic = this.topics.find(t => t.id.toLowerCase() === topicId.toLowerCase());
    return topic ? topic.name : 'Khác';
  }
}
