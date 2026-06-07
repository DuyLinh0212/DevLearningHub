import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TopicService } from '../../../core/services/topic.service';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar';

@Component({
  selector: 'app-topic-management',
  standalone: true,
  imports: [CommonModule, SidebarComponent, FormsModule],
  templateUrl: './topic-management.html',
  styleUrl: './topic-management.css'
})
export class TopicManagementComponent implements OnInit {
  private topicService = inject(TopicService);
  private cdr = inject(ChangeDetectorRef);
  
  topics: any[] = [];
  filteredTopics: any[] = [];
  searchText: string = '';
  isLoading: boolean = true;

  ngOnInit() {
    this.loadTopics();
  }

  loadTopics() {
    this.isLoading = true;
    this.topicService.getAllTopics().subscribe({
      next: (res) => {
        this.topics = Array.isArray(res) ? res : [];
        this.filteredTopics = [...this.topics];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.topics = [];
        this.filteredTopics = [];
        this.cdr.detectChanges();
      }
    });
  }

  filterTopics() {
    this.filteredTopics = this.topics.filter(t => 
      t.name.toLowerCase().includes(this.searchText.toLowerCase())
    );
  }

  deleteTopic(topicId: string) {
    if (!confirm('Bạn có chắc muốn xóa chủ đề này?')) return;

    this.topicService.deleteTopic(topicId).subscribe({
      next: () => {
        this.topics = this.topics.filter(t => t.id !== topicId);
        this.filterTopics();
        this.cdr.detectChanges();
        alert('Xóa thành công!');
      },
      error: (err) => {
        console.error(err);
        alert('Lỗi xóa chủ đề! Kiểm tra lại API Backend.');
      }
    });
  }

  openEditModal(topic: any) {
    console.log('Mở modal sửa chủ đề:', topic);
  }
}