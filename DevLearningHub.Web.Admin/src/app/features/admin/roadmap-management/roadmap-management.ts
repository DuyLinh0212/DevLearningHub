import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RoadmapService } from '../../../core/services/roadmap.service';
import { MobileMenuService } from '../../../core/services/mobile-menu.service';
import { AuthService } from '../../../core/services/auth.service';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';

interface RoadmapItem {
  id: string;
  itemType: string;
  topicId: string | null;
  quizSetId: string | null;
  problemId: string | null;
  problemBankId: string | null;
  title: string;
  description: string | null;
  orderIndex: number;
  isRequired: boolean;
  completed?: boolean;
}

interface Participant {
  userId: string;
  username: string;
  fullName: string | null;
  startedAt: string;
  completedAt: string | null;
  lastActivityAt: string | null;
  totalItems: number;
  completedItems: number;
  completionPercent: number;
}

@Component({
  selector: 'app-roadmap-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './roadmap-management.html',
  styleUrl: './roadmap-management.css'
})
export class RoadmapManagementComponent implements OnInit { 
  private roadmapService = inject(RoadmapService);
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  public mobileMenu = inject(MobileMenuService);

  roadmaps: any[] = [];
  availableTopics: any[] = [];
  availableQuizSets: any[] = [];
  availableProblems: any[] = [];
  availableProblemBanks: any[] = [];
  selectedRoadmap: any = null;
  isRoadmapModalOpen: boolean = false;
  isEditingRoadmap: boolean = false;
  editingRoadmapId: string = '';
  isAssignModalOpen: boolean = false;
  assignedTopicIds: string[] = [];

  // Item builder
  expandedRoadmapId: string | null = null;
  roadmapItems: RoadmapItem[] = [];
  isLoadingItems = false;
  isItemModalOpen = false;
  editingItem: RoadmapItem | null = null;
  itemForm = { itemType: 'topic' as string, topicId: '', quizSetId: '', problemId: '', problemBankId: '', titleOverride: '', descriptionOverride: '', isRequired: true };
  itemTypes = [
    { key: 'topic', label: 'Chủ đề' },
    { key: 'quiz_set', label: 'Bộ đề' },
    { key: 'problem', label: 'Bài code' },
    { key: 'problem_bank', label: 'Bộ bài code' }
  ];

  // Participants
  isParticipantsModalOpen = false;
  participantsList: Participant[] = [];
  participantsRoadmapTitle = '';
  isLoadingParticipants = false;

  // Permissions
  canCreate = false;
  canEdit = false;
  canDelete = false;
  canViewProgress = false;

  roadmapForm = {
    title: '',
    description: '',
    targetRole: 'Backend Developer',
    level: 'Trung bình'
  };

  ngOnInit() {
    this.resolvePermissions();
    this.loadRoadmaps();
    this.loadAvailableTopics();
    this.loadAvailableQuizSets();
    this.loadAvailableProblems();
    this.loadAvailableProblemBanks();
  }

  private resolvePermissions() {
    this.canCreate = this.auth.hasPermission('roadmap:create');
    this.canEdit = this.auth.hasPermission('roadmap:edit');
    this.canDelete = this.auth.hasPermission('roadmap:delete');
    this.canViewProgress = this.auth.hasPermission('roadmap:view_progress');
  }

  loadRoadmaps() {
    this.roadmapService.getAllRoadmaps().subscribe({
      next: (res: any) => {
        const actualData = res?.data || res;
        const dataArray = Array.isArray(actualData) ? actualData : [];

        this.roadmaps = dataArray.map((rm: any) => {
          const lvl = (rm.level || '').toLowerCase().trim();
          let vnLvl = 'Trung bình';
          if (lvl === 'beginner') vnLvl = 'Cơ bản';
          else if (lvl === 'advanced') vnLvl = 'Nâng cao';
          else if (lvl === 'intermediate') vnLvl = 'Trung bình';

          return {
            id: rm.id,
            title: rm.title || '',
            description: rm.description || '',
            targetRole: rm.targetRole || 'Web Developer',
            level: vnLvl,
            topicsCount: rm.topics ? rm.topics.length : 0,
            itemsCount: rm.items ? rm.items.length : 0,
            topicIds: rm.topics ? rm.topics.map((t: any) => t.topicId) : [],
            items: rm.items || []
          };
        });

        this.cdr.detectChanges();
      },
      error: (err) => console.error('Lỗi tải danh sách lộ trình:', err)
    });
  }

  loadAvailableQuizSets() {
    this.http.get<any>('/api/quiz-sets').subscribe({
      next: (res) => { this.availableQuizSets = res?.data ?? []; this.cdr.detectChanges(); }
    });
  }
  loadAvailableProblems() {
    this.http.get<any>('/api/problems').subscribe({
      next: (res) => { this.availableProblems = res?.data ?? []; this.cdr.detectChanges(); }
    });
  }
  loadAvailableProblemBanks() {
    this.http.get<any>('/api/problem-banks').subscribe({
      next: (res) => { this.availableProblemBanks = res?.data ?? []; this.cdr.detectChanges(); }
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

    let dbLevel = 'intermediate';
    const currentLevel = this.roadmapForm.level;
    if (currentLevel === 'Cơ bản') dbLevel = 'beginner';
    else if (currentLevel === 'Trung bình') dbLevel = 'intermediate';
    else if (currentLevel === 'Nâng cao' || currentLevel === 'Chuyên sâu') dbLevel = 'advanced';

    const payload = {
      title: this.roadmapForm.title.trim(),
      description: this.roadmapForm.description.trim(),
      targetRole: this.roadmapForm.targetRole,
      level: dbLevel
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

  // ===== Items =====

  toggleExpandRoadmap(roadmapId: string) {
    if (this.expandedRoadmapId === roadmapId) {
      this.expandedRoadmapId = null;
      this.roadmapItems = [];
      return;
    }
    this.expandedRoadmapId = roadmapId;
    this.loadRoadmapItems(roadmapId);
  }

  loadRoadmapItems(roadmapId: string) {
    this.isLoadingItems = true;
    this.roadmapItems = [];
    this.roadmapService.getAllRoadmaps().subscribe({
      next: (res: any) => {
        const data = res?.data || res || [];
        const found = (Array.isArray(data) ? data : []).find((r: any) => r.id === roadmapId);
        this.roadmapItems = (found?.items || []).map((it: any) => ({
          id: it.id,
          itemType: it.itemType,
          topicId: it.topicId ?? null,
          quizSetId: it.quizSetId ?? null,
          problemId: it.problemId ?? null,
          problemBankId: it.problemBankId ?? null,
          title: it.title || '',
          description: it.description ?? null,
          orderIndex: it.orderIndex,
          isRequired: it.isRequired
        }));
        this.isLoadingItems = false;
        this.cdr.detectChanges();
      },
      error: () => { this.isLoadingItems = false; this.cdr.detectChanges(); }
    });
  }

  getItemTypeLabel(type: string): string {
    const t = this.itemTypes.find(x => x.key === type);
    return t ? t.label : type;
  }

  getItemTypeIcon(type: string): string {
    switch (type) {
      case 'quiz_set': return 'bi-ui-checks-grid';
      case 'problem': return 'bi-code-slash';
      case 'problem_bank': return 'bi-collection';
      default: return 'bi-journal-code';
    }
  }

  getItemTypeClass(type: string): string {
    return `type-${type || 'topic'}`;
  }

  getRoadmapSummary(roadmap: any): string {
    const itemCount = roadmap.itemsCount || roadmap.items?.length || 0;
    const topicCount = roadmap.topicsCount || 0;
    if (itemCount > 0) return `${itemCount} mục học`;
    return `${topicCount} chủ đề`;
  }

  openItemModal(item: RoadmapItem | null = null) {
    if (!this.expandedRoadmapId) return;
    this.editingItem = item;
    if (item) {
      this.itemForm = {
        itemType: item.itemType,
        topicId: item.topicId || '',
        quizSetId: item.quizSetId || '',
        problemId: item.problemId || '',
        problemBankId: item.problemBankId || '',
        titleOverride: '',
        descriptionOverride: '',
        isRequired: item.isRequired
      };
    } else {
      this.itemForm = { itemType: 'topic', topicId: '', quizSetId: '', problemId: '', problemBankId: '', titleOverride: '', descriptionOverride: '', isRequired: true };
    }
    this.isItemModalOpen = true;
    this.cdr.detectChanges();
  }

  closeItemModal() {
    this.isItemModalOpen = false;
    this.editingItem = null;
  }

  onItemTypeChange() {
    this.itemForm.topicId = '';
    this.itemForm.quizSetId = '';
    this.itemForm.problemId = '';
    this.itemForm.problemBankId = '';
  }

  getSelectedItemId(): string {
    switch (this.itemForm.itemType) {
      case 'topic': return this.itemForm.topicId;
      case 'quiz_set': return this.itemForm.quizSetId;
      case 'problem': return this.itemForm.problemId;
      case 'problem_bank': return this.itemForm.problemBankId;
      default: return '';
    }
  }

  saveItem() {
    if (!this.expandedRoadmapId) return;
    const selectedId = this.getSelectedItemId();
    if (!selectedId) { alert('Vui lòng chọn một mục để thêm.'); return; }

    const payload: any = {
      itemType: this.itemForm.itemType,
      topicId: null, quizSetId: null, problemId: null, problemBankId: null,
      titleOverride: this.itemForm.titleOverride || null,
      descriptionOverride: this.itemForm.descriptionOverride || null,
      orderIndex: this.editingItem ? this.editingItem.orderIndex : this.roadmapItems.length + 1,
      isRequired: this.itemForm.isRequired
    };
    const idField = itemTypeToIdField(this.itemForm.itemType);
    payload[idField] = selectedId;

    const req$ = this.editingItem
      ? this.http.put<any>(`/api/roadmaps/${this.expandedRoadmapId}/items/${this.editingItem.id}`, payload)
      : this.http.post<any>(`/api/roadmaps/${this.expandedRoadmapId}/items`, payload);

    req$.subscribe({
      next: () => { this.loadRoadmapItems(this.expandedRoadmapId!); this.closeItemModal(); this.loadRoadmaps(); },
      error: (err) => alert(err.error?.message || 'Lỗi lưu item.')
    });
  }

  deleteItem(itemId: string) {
    if (!this.expandedRoadmapId || !confirm('Xóa mục này khỏi lộ trình?')) return;
    this.http.delete<any>(`/api/roadmaps/${this.expandedRoadmapId}/items/${itemId}`).subscribe({
      next: () => { this.loadRoadmapItems(this.expandedRoadmapId!); this.loadRoadmaps(); },
      error: (err) => alert(err.error?.message || 'Lỗi xóa item.')
    });
  }

  moveItemUp(item: RoadmapItem) {
    if (!this.expandedRoadmapId || item.orderIndex <= 1) return;
    this.reorderItem(item, item.orderIndex - 1);
  }

  moveItemDown(item: RoadmapItem) {
    if (!this.expandedRoadmapId || item.orderIndex >= this.roadmapItems.length) return;
    this.reorderItem(item, item.orderIndex + 1);
  }

  private reorderItem(item: RoadmapItem, newOrder: number) {
    const targetItem = this.roadmapItems.find(x => x.orderIndex === newOrder);
    if (!targetItem || !this.expandedRoadmapId) return;

    const currentPayload = this.buildItemPayload(item, newOrder);
    const targetPayload = this.buildItemPayload(targetItem, item.orderIndex);

    forkJoin([
      this.http.put<any>(`/api/roadmaps/${this.expandedRoadmapId}/items/${item.id}`, currentPayload),
      this.http.put<any>(`/api/roadmaps/${this.expandedRoadmapId}/items/${targetItem.id}`, targetPayload)
    ]).subscribe({
      next: () => this.loadRoadmapItems(this.expandedRoadmapId!),
      error: (err) => alert(err.error?.message || 'Lỗi sắp xếp lại.')
    });
  }

  private buildItemPayload(item: RoadmapItem, orderIndex: number): any {
    const payload: any = {
      itemType: item.itemType,
      topicId: null, quizSetId: null, problemId: null, problemBankId: null,
      titleOverride: item.title,
      orderIndex,
      isRequired: item.isRequired
    };
    const idField = itemTypeToIdField(item.itemType);
    payload[idField] = item.topicId || item.quizSetId || item.problemId || item.problemBankId;
    return payload;
  }

  // ===== Participants =====

  openParticipantsModal(roadmap: any) {
    this.participantsRoadmapTitle = roadmap.title;
    this.isParticipantsModalOpen = true;
    this.isLoadingParticipants = true;
    this.participantsList = [];
    this.http.get<any>(`/api/admin/roadmaps/${roadmap.id}/participants`).subscribe({
      next: (res) => {
        this.participantsList = (res?.data ?? []) as Participant[];
        this.isLoadingParticipants = false;
        this.cdr.detectChanges();
      },
      error: () => { this.isLoadingParticipants = false; this.cdr.detectChanges(); }
    });
  }

  closeParticipantsModal() {
    this.isParticipantsModalOpen = false;
    this.participantsList = [];
  }
}

function itemTypeToIdField(type: string): string {
  switch (type) {
    case 'topic': return 'topicId';
    case 'quiz_set': return 'quizSetId';
    case 'problem': return 'problemId';
    case 'problem_bank': return 'problemBankId';
    default: return 'topicId';
  }
}
