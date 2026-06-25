import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar';

@Component({
  selector: 'app-testcase-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SidebarComponent],
  templateUrl: './testcase-management.html',
  styleUrl: './testcase-management.css'
})
export class TestcaseManagementComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);

  problemId = '';
  problem: any = null;
  testCases: any[] = [];
  isLoading = true;

  // Form State
  isModalOpen = false;
  isEditing = false;
  editingTestCaseId = '';
  form = {
    input: '',
    expectedOutput: '',
    isHidden: false,
    orderIndex: 1
  };

  ngOnInit() {
    this.problemId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.problemId) {
      this.router.navigate(['/admin/problems']);
      return;
    }
    this.loadProblemInfo();
    this.loadTestCases();
  }

  loadProblemInfo() {
    this.http.get<any>(`/api/problems/${this.problemId}`).subscribe({
      next: (res) => {
        this.problem = res?.data || res;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        alert('Không thể tải thông tin bài tập.');
        this.router.navigate(['/admin/problems']);
      }
    });
  }

  loadTestCases() {
    this.isLoading = true;
    this.http.get<any>(`/api/problems/${this.problemId}/test-cases`).subscribe({
      next: (res) => {
        const data = res?.data || res;
        this.testCases = Array.isArray(data) ? data : [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi tải test cases:', err);
        this.isLoading = false;
        this.testCases = [];
        this.cdr.detectChanges();
      }
    });
  }

  openModal(tc: any = null) {
    if (tc) {
      this.isEditing = true;
      this.editingTestCaseId = tc.id;
      this.form = {
        input: tc.input || '',
        expectedOutput: tc.expectedOutput || '',
        isHidden: !!tc.isHidden,
        orderIndex: tc.orderIndex || 1
      };
    } else {
      this.isEditing = false;
      this.editingTestCaseId = '';
      this.form = {
        input: '',
        expectedOutput: '',
        isHidden: false,
        orderIndex: this.testCases.length + 1
      };
    }
    this.isModalOpen = true;
    this.cdr.detectChanges();
  }

  closeModal() {
    this.isModalOpen = false;
    this.cdr.detectChanges();
  }

  saveTestCase() {
    // Note: expectedOutput is required, input can be empty (e.g. hello world problem)
    if (!this.form.expectedOutput) {
      alert('Vui lòng nhập Kết quả mong đợi (Expected Output).');
      return;
    }

    const payload = {
      input: this.form.input,
      expectedOutput: this.form.expectedOutput,
      isHidden: this.form.isHidden,
      orderIndex: Number(this.form.orderIndex || 1)
    };

    const req$ = this.isEditing
      ? this.http.put<any>(`/api/test-cases/${this.editingTestCaseId}`, payload)
      : this.http.post<any>(`/api/problems/${this.problemId}/test-cases`, payload);

    req$.subscribe({
      next: () => {
        alert(this.isEditing ? 'Cập nhật Test Case thành công!' : 'Thêm Test Case mới thành công!');
        this.closeModal();
        this.loadTestCases();
      },
      error: (err) => {
        console.error('Lỗi lưu testcase:', err);
        alert(err?.error?.message || 'Có lỗi xảy ra khi lưu Test Case.');
      }
    });
  }

  deleteTestCase(id: string) {
    if (!confirm('Bạn có chắc chắn muốn xóa Test Case này không?')) return;
    this.http.delete<any>(`/api/test-cases/${id}`).subscribe({
      next: () => {
        alert('Xóa Test Case thành công!');
        this.loadTestCases();
      },
      error: (err) => {
        console.error(err);
        alert('Không thể xóa Test Case này.');
      }
    });
  }
}
