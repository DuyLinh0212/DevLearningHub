import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { RoadmapService } from '../../../core/services/roadmap.service';

interface RoadmapNode {
  stepNum: number;
  id: string | null;
  name: string;
  desc: string;
  icon: string;
  type: string;
  typeLabel: string;
  isRequired: boolean;
  status: 'available' | 'empty';
  route: string[];
}

@Component({
  selector: 'app-roadmap-view',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './roadmap-view.html',
  styleUrl: './roadmap-view.css'
})
export class RoadmapViewComponent implements OnInit {
  private roadmapService = inject(RoadmapService);
  private cdr = inject(ChangeDetectorRef);

  roadmaps: any[] = [];
  activeRoadmap: any = null;
  roadmapNodes: RoadmapNode[] = [];
  isLoading = false;
  loadError = '';

  ngOnInit() {
    this.loadUserRoadmaps();
  }

  loadUserRoadmaps() {
    this.isLoading = true;
    this.loadError = '';

    this.roadmapService.getAllRoadmaps().subscribe({
      next: (res: any) => {
        const actualData = res?.data || res;
        this.roadmaps = Array.isArray(actualData) ? actualData : [];
        this.activeRoadmap = this.roadmaps[0] ?? null;
        this.roadmapNodes = this.activeRoadmap ? this.buildNodes(this.activeRoadmap) : [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.loadError = 'Không tải được danh sách lộ trình. Vui lòng thử lại.';
        this.cdr.detectChanges();
      }
    });
  }

  selectRoadmap(roadmap: any) {
    this.activeRoadmap = roadmap;
    this.roadmapNodes = this.buildNodes(roadmap);
    this.cdr.detectChanges();
  }

  getLevelName(level: string): string {
    const l = (level || '').toLowerCase().trim();
    if (l === 'beginner' || l === 'dễ') return 'Cơ bản';
    if (l === 'advanced' || l === 'hard' || l === 'khó') return 'Nâng cao';
    return 'Trung cấp';
  }

  getRoadmapItemCount(roadmap: any): number {
    const items = Array.isArray(roadmap?.items) ? roadmap.items : [];
    const topics = Array.isArray(roadmap?.topics) ? roadmap.topics : [];
    return items.length || topics.length;
  }

  private buildNodes(roadmap: any): RoadmapNode[] {
    const items = Array.isArray(roadmap?.items) ? roadmap.items : [];

    if (items.length) {
      return items
        .slice()
        .sort((a: any, b: any) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
        .map((item: any, index: number) => this.mapItemNode(item, index));
    }

    const topics = Array.isArray(roadmap?.topics) ? roadmap.topics : [];
    return topics
      .slice()
      .sort((a: any, b: any) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
      .map((topic: any, index: number) => ({
        stepNum: index + 1,
        id: topic.topicId,
        name: topic.name || 'Chủ đề kiến thức',
        desc: `Hệ thống hóa kiến thức trọng tâm và luyện tập theo chủ đề ${topic.name || 'này'}.`,
        icon: 'bi-journal-code',
        type: 'topic',
        typeLabel: 'Chủ đề',
        isRequired: true,
        status: 'available',
        route: ['/quiz-bank']
      }));
  }

  private mapItemNode(item: any, index: number): RoadmapNode {
    const type = item.itemType || 'topic';
    const id = item.topicId || item.quizSetId || item.problemId || item.problemBankId || null;

    return {
      stepNum: index + 1,
      id,
      name: item.title || 'Mục học tập',
      desc: item.description || this.defaultDescription(type),
      icon: this.getItemIcon(type),
      type,
      typeLabel: this.getItemTypeLabel(type),
      isRequired: item.isRequired !== false,
      status: id ? 'available' : 'empty',
      route: this.getItemRoute(type, id)
    };
  }

  private getItemTypeLabel(type: string): string {
    switch (type) {
      case 'quiz_set': return 'Bộ đề';
      case 'problem': return 'Bài code';
      case 'problem_bank': return 'Bộ bài code';
      default: return 'Chủ đề';
    }
  }

  private getItemIcon(type: string): string {
    switch (type) {
      case 'quiz_set': return 'bi-ui-checks-grid';
      case 'problem': return 'bi-code-slash';
      case 'problem_bank': return 'bi-collection';
      default: return 'bi-journal-code';
    }
  }

  private getItemRoute(type: string, id: string | null): string[] {
    if (type === 'quiz_set' && id) return ['/quiz', id];
    if (type === 'problem' && id) return ['/code', id];
    if (type === 'problem_bank') return ['/code'];
    return ['/quiz-bank'];
  }

  private defaultDescription(type: string): string {
    switch (type) {
      case 'quiz_set': return 'Làm bộ đề để kiểm tra mức độ nắm kiến thức trong chặng này.';
      case 'problem': return 'Giải bài code để rèn kỹ năng triển khai và tư duy thuật toán.';
      case 'problem_bank': return 'Hoàn thành nhóm bài code theo cùng một mục tiêu luyện tập.';
      default: return 'Ôn tập kiến thức nền và chuẩn bị cho các chặng tiếp theo.';
    }
  }
}
