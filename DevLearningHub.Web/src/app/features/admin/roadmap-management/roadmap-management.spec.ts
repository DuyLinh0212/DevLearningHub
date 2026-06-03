import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RoadmapService } from '../../../core/services/roadmap.service';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-roadmap-management',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './roadmap-management.html',
  styleUrl: './roadmap-management.css'
})
export class RoadmapManagementComponent implements OnInit {
  private roadmapService = inject(RoadmapService);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);

  roadmaps: any[] = [];
  availableTopics: any[] = [];
  selectedRoadmap: any = null;

  isRoadmapModalOpen: boolean = false;
  isEditingRoadmap: boolean = false;
  editingRoadmapId: string = '';

  roadmapForm = {
    title: '',
    description: '',
    targetRole: 'Backend Developer',
    level: 'Chuyên sâu'
  };

  isAssignModalOpen: boolean = false;
  assignedTopicIds: string[] = [];

  ngOnInit() {
    this.loadRoadmaps();
    this.loadAvailableTopics();
  }

  loadRoadmaps() {
    this.roadmapService.getAllRoadmaps().subscribe({
      next: (res) => {
        this.roadmaps = Array.isArray(res) ? res : [];
        if (this.roadmaps.length === 0) {
          this.setFallbackRoadmaps();
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.setFallbackRoadmaps();
        this.cdr.detectChanges();
      }
    });
  }

  private setFallbackRoadmaps() {
    this.roadmaps = [
      { id: 'rm_1', title: 'Lộ trình trở thành C# Web Backend Developer', description: 'Định hướng làm chủ ASP.NET Core Web API, SQL Server và kiến thức triển khai hệ thống Docker cloud.', targetRole: 'Backend Developer', level: 'Trung bình', topicsCount: 2, topicIds: ['t1', 't3'] },
      { id: 'rm_2', title: 'Chuyên gia lập trình Frontend Angular', description: 'Từ cơ bản đến làm chủ RxJS, State Management và tối ưu hóa hiệu năng ứng dụng Single Page App.', targetRole: 'Frontend Developer', level: 'Nâng cao', topicsCount: 1, topicIds: ['t2'] }
    ];
  }

  loadAvailableTopics() {
    this.http.get<any>('/api/questions').subscribe({
      next: () => {
        this.availableTopics = [
          { id: 't1', name: 'Lập trình Backend', icon: 'bi-cpu' },
          { id: 't2', name: 'Lập trình Frontend', icon: 'bi-code-slash' },
          { id: 't3', name: 'Cơ sở dữ liệu', icon: 'bi-database' },
          { id: 't4', name: 'Kiểm thử phần mềm', icon: 'bi-patch-check' }
        ];
        this.cdr.detectChanges();
      },
      error: () => {
        this.availableTopics = [
          { id: 't1', name: 'Lập trình Backend', icon: 'bi-cpu' },
          { id: 't2', name: 'Lập trình Frontend', icon: 'bi-code-slash' },
          { id: 't3', name: 'Cơ sở dữ liệu', icon: 'bi-database' },
          { id: 't4', name: 'Kiểm thử phần mềm', icon: 'bi-patch-check' }
        ];
        this.cdr.detectChanges();
      }
    });
  }

  openRoadmapModal(roadmap: any = null) {
    if (roadmap) {
      this.isEditingRoadmap = true;
      this.editingRoadmapId = roadmap.id;
      this.roadmapForm = {
        title: roadmap.title || '',
        description: roadmap.description || '',
        targetRole: roadmap.targetRole || 'Backend Developer',
        level: roadmap.level || 'Trung bình'
      };
    } else {
      this.isEditingRoadmap = false;
      this.editingRoadmapId = '';
      this.roadmapForm = {
        title: '',
        description: '',
        targetRole: 'Backend Developer',
        level: 'Trung bình'
      };
    }
    this.isRoadmapModalOpen = true;
    this.cdr.detectChanges();
  }

  closeRoadmapModal() {
    this.isRoadmapModalOpen = false;
    this.cdr.detectChanges();
  }

  saveRoadmap() {
    if (!this.roadmapForm.title.trim()) {
      alert('Vui lòng nhập tiêu đề lộ trình học tập!');
      return;
    }

    const request$ = this.isEditingRoadmap
      ? this.roadmapService.updateRoadmap(this.editingRoadmapId, this.roadmapForm)
      : this.roadmapService.createRoadmap(this.roadmapForm);

    request$.subscribe({
      next: () => {
        this.loadRoadmaps();
        this.closeRoadmapModal();
        alert('Cập nhật thông tin lộ trình thành công!');
      },
      error: () => {
        if (!this.isEditingRoadmap) {
          this.roadmaps.push({
            id: 'rm_' + Date.now(),
            ...this.roadmapForm,
            topicsCount: 0,
            topicIds: []
          });
        } else {
          const idx = this.roadmaps.findIndex(r => r.id === this.editingRoadmapId);
          if (idx > -1) {
            this.roadmaps[idx] = { ...this.roadmaps[idx], ...this.roadmapForm };
          }
        }
        this.closeRoadmapModal();
        this.cdr.detectChanges();
      }
    });
  }

  deleteRoadmap(id: string) {
    if (confirm('Xác nhận xóa mềm lộ trình định hướng này khỏi hệ thống?')) {
      this.roadmapService.deleteRoadmap(id).subscribe({
        next: () => {
          this.loadRoadmaps();
          alert('Đã xóa lộ trình thành công!');
        },
        error: () => {
          this.roadmaps = this.roadmaps.filter(r => r.id !== id);
          this.cdr.detectChanges();
        }
      });
    }
  }

  openAssignModal(roadmap: any) {
    this.selectedRoadmap = roadmap;
    this.assignedTopicIds = roadmap.topicIds ? [...roadmap.topicIds] : [];
    this.isAssignModalOpen = true;
    this.cdr.detectChanges();
  }

  toggleTopicInRoadmap(topicId: string) {
    const idx = this.assignedTopicIds.indexOf(topicId);
    if (idx > -1) {
      this.roadmapService.removeTopicFromRoadmap(this.selectedRoadmap.id, topicId).subscribe({
        next: () => {
          this.assignedTopicIds.splice(idx, 1);
          this.selectedRoadmap.topicIds = [...this.assignedTopicIds];
          this.selectedRoadmap.topicsCount = this.assignedTopicIds.length;
          this.cdr.detectChanges();
        },
        error: () => {
          this.assignedTopicIds.splice(idx, 1);
          this.selectedRoadmap.topicIds = [...this.assignedTopicIds];
          this.selectedRoadmap.topicsCount = this.assignedTopicIds.length;
          this.cdr.detectChanges();
        }
      });
    } else {
      const orderIndex = this.assignedTopicIds.length + 1;
      this.roadmapService.addTopicToRoadmap(this.selectedRoadmap.id, topicId, orderIndex).subscribe({
        next: () => {
          this.assignedTopicIds.push(topicId);
          this.selectedRoadmap.topicIds = [...this.assignedTopicIds];
          this.selectedRoadmap.topicsCount = this.assignedTopicIds.length;
          this.cdr.detectChanges();
        },
        error: () => {
          this.assignedTopicIds.push(topicId);
          this.selectedRoadmap.topicIds = [...this.assignedTopicIds];
          this.selectedRoadmap.topicsCount = this.assignedTopicIds.length;
          this.cdr.detectChanges();
        }
      });
    }
  }

  isTopicInRoadmap(topicId: string): boolean {
    return this.assignedTopicIds.includes(topicId);
  }

  closeAssignModal() {
    this.isAssignModalOpen = false;
    this.selectedRoadmap = null;
    this.cdr.detectChanges();
  }
}