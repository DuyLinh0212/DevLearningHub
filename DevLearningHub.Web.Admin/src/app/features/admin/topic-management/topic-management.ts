import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
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
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  
  topics: any[] = [];
  filteredTopics: any[] = [];
  searchText: string = '';
  isLoading: boolean = true;

  isTopicModalOpen: boolean = false;
  isEditingTopic: boolean = false;
  editingTopicId: string = '';

  topicForm = {
    name: '',
    description: '',
    icon: 'bi-code-slash'
  };

  ngOnInit() {
    this.loadTopics();
  }

  loadTopics() {
    this.isLoading = true;
    this.topicService.getAllTopics().subscribe({
      next: (res: any) => {
        console.log('=== ADMIN_TOPIC: DỮ LIỆU CHỦ ĐỀ RAW TỪ SERVER ===', res);
        
        const actualData = res?.data || res;
        this.topics = Array.isArray(actualData) ? actualData : [];
        this.filteredTopics = [...this.topics];
        
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi nạp danh mục chủ đề:', err);
        this.isLoading = false;
        this.topics = [];
        this.filteredTopics = [];
        this.cdr.detectChanges();
      }
    });
  }

  filterTopics() {
    if (!this.searchText.trim()) {
      this.filteredTopics = [...this.topics];
      return;
    }
    this.filteredTopics = this.topics.filter(t => 
      (t.name || '').toLowerCase().includes(this.searchText.toLowerCase()) ||
      (t.description || '').toLowerCase().includes(this.searchText.toLowerCase())
    );
  }

  openTopicModal(topic: any = null) {
    if (topic) {
      this.isEditingTopic = true;
      this.editingTopicId = topic.id;
      this.topicForm = {
        name: topic.name || '',
        description: topic.description || '',
        icon: topic.icon || 'bi-code-slash'
      };
    } else {
      this.isEditingTopic = false;
      this.editingTopicId = '';
      this.topicForm = {
        name: '',
        description: '',
        icon: 'bi-code-slash'
      };
    }
    this.isTopicModalOpen = true;
    this.cdr.detectChanges();
  }

  closeTopicModal() {
    this.isTopicModalOpen = false;
    this.cdr.detectChanges();
  }

  saveTopic() {
    if (!this.topicForm.name.trim()) {
      alert('Vui lòng nhập tên chủ đề công nghệ!');
      return;
    }

    const payload = {
      name: this.topicForm.name.trim(),
      description: this.topicForm.description.trim(),
      icon: this.topicForm.icon.trim()
    };

    console.log('=== PAYLOAD GỬI LÊN API CHỦ ĐỀ ===', payload);

    const request$ = this.isEditingTopic && this.editingTopicId
      ? this.http.put<any>(`/api/topics/${this.editingTopicId}`, payload)
      : this.http.post<any>('/api/topics', payload);

    request$.subscribe({
      next: () => {
        this.loadTopics();
        this.closeTopicModal();
        alert('Cập nhật danh mục chủ đề thành công!');
      },
      error: (err) => {
        console.error(err);
        alert(`Backend từ chối lưu dữ liệu (Mã lỗi: ${err.status}). Hãy check lại endpoint.`);
      }
    });
  }

  deleteTopic(topicId: string) {
    if (!confirm('Hành động này sẽ xóa vĩnh viễn chủ đề. Bạn có chắc chắn muốn xóa không?')) return;

    this.topicService.deleteTopic(topicId).subscribe({
      next: () => {
        this.topics = this.topics.filter(t => t.id !== topicId);
        this.filterTopics();
        this.cdr.detectChanges();
        alert('Đã dọn sạch chủ đề khỏi hệ thống!');
      },
      error: (err) => {
        console.error('Lỗi xóa thực thể:', err);
        this.topics = this.topics.filter(t => t.id !== topicId);
        this.filterTopics();
        this.cdr.detectChanges();
      }
    });
  }
}