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
  isAssignModalOpen: boolean = false;
  assignedTopicIds: string[] = [];

  roadmapForm = {
    title: '',
    description: '',
    targetRole: 'Backend Developer',
    level: 'Trung bình'
  };

  ngOnInit() {
    this.loadRoadmaps();
    this.loadAvailableTopics();
  }

  loadRoadmaps() {
    this.roadmapService.getAllRoadmaps().subscribe({
      next: (res) => {
        this.roadmaps = Array.isArray(res) ? res : [];
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi tải lộ trình:', err);
        alert('Không thể kết nối tới Server để lấy lộ trình!');
      }
    });
  }

  loadAvailableTopics() {
    this.http.get<any>('/api/topics').subscribe({
      next: (res) => {
        this.availableTopics = res?.data || res || [];
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi lấy danh sách chủ đề:', err);
      }
    });
  }

  saveRoadmap() {
    if (!this.roadmapForm.title.trim()) {
      alert('Vui lòng nhập tiêu đề lộ trình!');
      return;
    }

    const request$ = this.isEditingRoadmap
      ? this.roadmapService.updateRoadmap(this.editingRoadmapId, this.roadmapForm)
      : this.roadmapService.createRoadmap(this.roadmapForm);

    request$.subscribe({
      next: () => {
        this.loadRoadmaps();
        this.closeRoadmapModal();
        alert('Thành công!');
      },
      error: (err) => {
        alert('Lỗi: Server chưa phản hồi đúng (kiểm tra lại API POST/PUT)!');
      }
    });
  }

  deleteRoadmap(id: string) {
    if (confirm('Xác nhận xóa lộ trình?')) {
      this.roadmapService.deleteRoadmap(id).subscribe({
        next: () => {
          this.loadRoadmaps();
          alert('Đã xóa!');
        },
        error: (err) => {
          alert('Lỗi: Server không cho phép xóa!');
        }
      });
    }
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
          this.executeToggleOption(idx);
        },
        error: () => {
          this.executeToggleOption(idx);
        }
      });
    } else {
      const orderIndex = this.assignedTopicIds.length + 1;
      this.roadmapService.addTopicToRoadmap(this.selectedRoadmap.id, topicId, orderIndex).subscribe({
        next: () => {
          this.executePushOption(topicId);
        },
        error: () => {
          this.executePushOption(topicId);
        }
      });
    }
  }

  private executeToggleOption(idx: number) {
    this.assignedTopicIds.splice(idx, 1);
    this.selectedRoadmap.topicIds = [...this.assignedTopicIds];
    this.selectedRoadmap.topicsCount = this.assignedTopicIds.length;
    this.cdr.detectChanges();
  }

  private executePushOption(topicId: string) {
    this.assignedTopicIds.push(topicId);
    this.selectedRoadmap.topicIds = [...this.assignedTopicIds];
    this.selectedRoadmap.topicsCount = this.assignedTopicIds.length;
    this.cdr.detectChanges();
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