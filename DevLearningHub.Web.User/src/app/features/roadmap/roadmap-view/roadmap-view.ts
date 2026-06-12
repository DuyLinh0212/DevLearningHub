import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { RoadmapService } from '../../../core/services/roadmap.service';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar';

@Component({
  selector: 'app-roadmap-view',
  standalone: true,
  imports: [CommonModule, RouterLink, SidebarComponent],
  templateUrl: './roadmap-view.html',
  styleUrl: './roadmap-view.css'
})
export class RoadmapViewComponent implements OnInit {
  private roadmapService = inject(RoadmapService);
  private cdr = inject(ChangeDetectorRef);

  roadmaps: any[] = [];
  activeRoadmap: any = null;
  roadmapNodes: any[] = [];
  isLoadingNodes: boolean = false;

  ngOnInit() {
    this.loadUserRoadmaps();
  }

  loadUserRoadmaps() {
    console.log('=== ROADMAP: BẮT ĐẦU TẢI DANH SÁCH LỘ TRÌNH TỪ SWAGGER ===');
    this.roadmapService.getAllRoadmaps().subscribe({
      next: (res: any) => {
        console.log('=== DỮ LIỆU LỘ TRÌNH RAW TỪ SERVER ===', res);
        
        // PHÁ VỠ VỎ BỌC APIRESPONSE ĐỂ LẤY MẢNG DỮ LIỆU CHUẨN
        const actualData = res?.data || res;
        this.roadmaps = Array.isArray(actualData) ? actualData : [];
        
        if (this.roadmaps.length > 0) {
          this.selectRoadmap(this.roadmaps[0]);
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error("Lỗi lấy danh sách lộ trình từ Server:", err);
      }
    });
  }

  selectRoadmap(rm: any) {
    console.log('=== HỌC VIÊN BẤM CHỌN LỘ TRÌNH ===', rm);
    this.activeRoadmap = rm;
    this.roadmapNodes = [];

    // TỐI ƯU TUYỆT ĐỐI: Đọc mảng topics lồng sẵn từ Swagger, không gọi thêm API phụ
    const rawTopics = rm.topics || [];
    
    this.roadmapNodes = rawTopics.map((item: any, index: number) => {
      // Mô phỏng trạng thái mở khóa chặng học (Chặng 1 làm rồi, Chặng 2 đang học, còn lại khóa)
      let calculatedStatus = 'locked';
      if (index === 0) {
        calculatedStatus = 'completed';
      } else if (index === 1) {
        calculatedStatus = 'current';
      }

      return {
        stepNum: index + 1,
        id: item.topicId,
        name: item.name || 'Chủ đề kiến thức',
        desc: `Hệ thống hóa lý thuyết cốt lõi, sơ đồ tư duy và tham gia luyện tập bộ đề trắc nghiệm lập trình chuyên sâu liên quan đến ${item.name || 'chủ đề này'}.`,
        icon: 'bi-journal-code', // Đồng bộ icon lập trình công nghệ chuyên sâu
        status: calculatedStatus
      };
    });

    this.cdr.detectChanges();
  }

  getLevelName(level: string): string {
    const l = (level || '').toLowerCase().trim();
    if (l === 'beginner' || l === 'dễ') return 'Cơ bản';
    if (l === 'advanced' || l === 'hard' || l === 'khó') return 'Nâng cao';
    return 'Trung cấp';
  }
}