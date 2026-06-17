import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RoadmapService } from '../../../core/services/roadmap.service';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar';
import { MobileMenuService } from '../../../core/services/mobile-menu.service';
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
  public mobileMenu = inject(MobileMenuService);

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
    console.log('=== ADMIN_ROADMAP: BẮT ĐẦU TẢI LỘ TRÌNH TỪ SERVER ===');
    this.roadmapService.getAllRoadmaps().subscribe({
      next: (res: any) => {
        const actualData = res?.data || res;
        const dataArray = Array.isArray(actualData) ? actualData : [];
        
        this.roadmaps = dataArray.map((rm: any) => ({
          id: rm.id,
          title: rm.title || '',
          description: rm.description || '',
          targetRole: rm.targetRole || 'Web Developer', 
          level: rm.level || 'Trung bình',
          topicsCount: rm.topics ? rm.topics.length : 0,
          topicIds: rm.topics ? rm.topics.map((t: any) => t.topicId) : []
        }));
        
        console.log('=== ADMIN_ROADMAP: MẢNG LỘ TRÌNH ĐÃ ĐỒNG BỘ SWAGGER ===', this.roadmaps);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi tải danh sách lộ trình tổng quan:', err);
      }
    });
  }

  loadAvailableTopics() {
    this.http.get<any>('/api/topics').subscribe({
      next: (res: any) => {
        const actualTopics = res?.data || res;
        this.availableTopics = Array.isArray(actualTopics) ? actualTopics : [];
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi lấy ngân hàng danh mục chủ đề:', err);
      }
    });
  }

  saveRoadmap() {
    if (!this.roadmapForm.title.trim()) {
      alert('Vui lòng nhập tiêu đề định hướng lộ trình!');
      return;
    }

    const payload = {
      title: this.roadmapForm.title.trim(),
      description: this.roadmapForm.description.trim(),
      targetRole: this.roadmapForm.targetRole,
      level: this.roadmapForm.level
    };

    const request$ = this.isEditingRoadmap
      ? this.roadmapService.updateRoadmap(this.editingRoadmapId, payload)
      : this.roadmapService.createRoadmap(payload);

    request$.subscribe({
      next: () => {
        this.loadRoadmaps();
        this.closeRoadmapModal();
        alert('Lưu thông số cấu trúc lộ trình thành công!');
      },
      error: (err) => {
        alert('Server từ chối dữ liệu! Vui lòng kiểm tra lại phương thức POST/PUT.');
      }
    });
  }

  deleteRoadmap(id: string) {
    if (confirm('Xác nhận xóa hoàn toàn lộ trình công nghệ này khỏi hệ thống phân phối?')) {
      this.roadmapService.deleteRoadmap(id).subscribe({
        next: () => {
          this.loadRoadmaps();
          alert('Đã dọn sạch lộ trình thành công!');
        },
        error: () => {
          this.roadmaps = this.roadmaps.filter(r => r.id !== id);
          this.cdr.detectChanges();
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
    if (!this.selectedRoadmap) return;
    
    const index = this.assignedTopicIds.indexOf(topicId);
    const isAssigned = index > -1;
    
    const obs$ = isAssigned 
      ? this.roadmapService.removeTopicFromRoadmap(this.selectedRoadmap.id, topicId)
      : this.roadmapService.addTopicToRoadmap(this.selectedRoadmap.id, topicId, this.assignedTopicIds.length + 1);

    obs$.subscribe({
      next: () => {
        if (isAssigned) {
          this.assignedTopicIds.splice(index, 1);
        } else {
          this.assignedTopicIds.push(topicId);
        }
        this.selectedRoadmap.topicIds = [...this.assignedTopicIds];
        this.selectedRoadmap.topicsCount = this.assignedTopicIds.length;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi thực thi gán/hủy danh mục:', err);
        if (isAssigned) {
          this.assignedTopicIds.splice(index, 1);
        } else {
          this.assignedTopicIds.push(topicId);
        }
        this.selectedRoadmap.topicIds = [...this.assignedTopicIds];
        this.selectedRoadmap.topicsCount = this.assignedTopicIds.length;
        this.cdr.detectChanges();
      }
    });
  }

  isTopicInRoadmap(topicId: string): boolean {
    return this.assignedTopicIds.includes(topicId);
  }

  closeAssignModal() {
    this.isAssignModalOpen = false;
    this.selectedRoadmap = null;
    this.loadRoadmaps();
    this.cdr.detectChanges();
  }
}