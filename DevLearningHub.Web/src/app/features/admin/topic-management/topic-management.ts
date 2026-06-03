import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TopicService } from '../../../core/services/topic.service';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar';

@Component({
  selector: 'app-topic-management',
  standalone: true,
  imports: [CommonModule, SidebarComponent],
  templateUrl: './topic-management.html',
  styleUrl: './topic-management.css'
})
export class TopicManagementComponent implements OnInit {
  private topicService = inject(TopicService);
  private cdr = inject(ChangeDetectorRef);
  
  topics: any[] = [];
  isLoading: boolean = true;

  ngOnInit() {
    this.loadTopics();
  }

  loadTopics() {
    this.isLoading = true;
    this.topicService.getAllTopics().subscribe({
      next: (res) => {
        console.log('Dữ liệu từ API:', res);
        this.topics = res;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.topics = [];
        this.cdr.detectChanges();
      }
    });
  }

  openTopicModal() {
    console.log('Mở modal thêm chủ đề mới');
  }

  openEditModal(topic: any) {
    console.log('Mở modal sửa chủ đề:', topic);
  }
}