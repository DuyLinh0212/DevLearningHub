import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
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
    this.roadmapService.getAllRoadmaps().subscribe({
      next: (res) => {
        this.roadmaps = Array.isArray(res) ? res : [];
        if (this.roadmaps.length > 0) {
          this.selectRoadmap(this.roadmaps[0]);
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error("Lỗi lấy danh sách lộ trình:", err);
      }
    });
  }

  selectRoadmap(rm: any) {
    this.activeRoadmap = rm;
    this.roadmapNodes = [];
    this.isLoadingNodes = true;

    this.roadmapService.getRoadmapTopics(rm.id).subscribe({
      next: (data) => {
        this.roadmapNodes = data.map((item: any, index: number) => ({
          stepNum: index + 1,
          name: item.name,
          desc: item.description,
          icon: item.icon || 'bi-book',
          status: item.status || 'locked'
        }));
        this.isLoadingNodes = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoadingNodes = false;
        this.cdr.detectChanges();
      }
    });
  }
}