import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { RoadmapService } from '../../../core/services/roadmap.service';

interface RoadmapNode {
  stepNum: number;
  itemId: string | null;
  id: string | null;
  name: string;
  desc: string;
  icon: string;
  type: string;
  typeLabel: string;
  isRequired: boolean;
  completed: boolean;
  status: 'available' | 'empty' | 'locked';
  route: string[];
  queryParams: any;
}

interface RoadmapFormState {
  title: string;
  description: string;
  level: string;
  isPublic: boolean;
}

interface ItemFormState {
  itemType: string;
  topicId: string;
  quizSetId: string;
  problemId: string;
  problemBankId: string;
  orderIndex: number;
  isRequired: boolean;
  passThreshold: number;
}

@Component({
  selector: 'app-roadmap-view',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './roadmap-view.html',
  styleUrl: './roadmap-view.css'
})
export class RoadmapViewComponent implements OnInit {
  private readonly roadmapService = inject(RoadmapService);
  private readonly http = inject(HttpClient);
  private readonly cdr = inject(ChangeDetectorRef);

  roadmaps: any[] = [];
  activeRoadmap: any = null;
  roadmapNodes: RoadmapNode[] = [];
  isLoading = false;
  loadError = '';

  currentUserId = '';

  isRoadmapModalOpen = false;
  isSavingRoadmap = false;
  roadmapSaveError = '';
  editingRoadmapId: string | null = null;
  roadmapForm: RoadmapFormState = this.createDefaultRoadmapForm();

  isItemModalOpen = false;
  isSavingItem = false;
  itemSaveError = '';
  itemForm: ItemFormState = this.createDefaultItemForm();
  itemOptions: any[] = [];
  isLoadingItemOptions = false;
  isDescriptionExpanded = false;

  toggleDescription() {
    this.isDescriptionExpanded = !this.isDescriptionExpanded;
  }

  ngOnInit() {
    this.loadViewerContext();
    this.loadUserRoadmaps();
  }

  get canCreateRoadmap(): boolean {
    // Ownership-based: any logged-in user can create a roadmap.
    return !!this.currentUserId;
  }

  get isEditingRoadmap(): boolean {
    return Boolean(this.editingRoadmapId);
  }

  loadUserRoadmaps(preferredRoadmapId?: string) {
    this.isLoading = true;
    this.loadError = '';

    const currentActiveId = preferredRoadmapId || this.activeRoadmap?.id || null;

    this.roadmapService.getAllRoadmaps().subscribe({
      next: (roadmaps: any[]) => {
        const actualData = Array.isArray(roadmaps) ? roadmaps : [];
        this.roadmaps = actualData;
        this.activeRoadmap = this.pickActiveRoadmap(actualData, currentActiveId);
        this.roadmapNodes = this.activeRoadmap ? this.buildNodes(this.activeRoadmap) : [];
        this.isLoading = false;
        this.cdr.detectChanges();
        if (this.activeRoadmap) {
          this.loadProgress(this.activeRoadmap.id);
        }
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
    this.isDescriptionExpanded = false;
    this.roadmapNodes = this.buildNodes(roadmap);
    this.cdr.detectChanges();
    this.loadProgress(roadmap.id);
  }

  private loadProgress(roadmapId: string) {
    this.roadmapService.getMyProgress(roadmapId).subscribe({
      next: (progress) => this.applyProgress(progress),
      error: () => {
        this.roadmapService.startRoadmap(roadmapId).subscribe({
          next: (progress) => this.applyProgress(progress),
          error: () => { /* viewer chưa đăng nhập hoặc không thể bắt đầu, giữ trạng thái mặc định */ }
        });
      }
    });
  }

  private applyProgress(progress: any) {
    if (!progress || this.activeRoadmap?.id !== progress.roadmapId) {
      return;
    }

    const items = Array.isArray(progress.items) ? progress.items : [];
    const byId = new Map(items.map((i: any) => [i.id, i]));

    this.roadmapNodes = this.roadmapNodes.map(node => {
      const match: any = node.itemId ? byId.get(node.itemId) : null;
      if (!match) {
        return node;
      }

      const completed = Boolean(match.completed);
      const unlocked = match.unlocked !== false;
      return {
        ...node,
        completed,
        status: node.id ? (unlocked ? 'available' : 'locked') : node.status
      };
    });

    this.cdr.detectChanges();
  }

  canEditRoadmap(roadmap: any): boolean {
    if (!roadmap) return false;
    return this.isOwnRoadmap(roadmap);
  }

  canDeleteRoadmap(roadmap: any): boolean {
    if (!roadmap) return false;
    return this.isOwnRoadmap(roadmap);
  }

  openRoadmapModal(roadmap: any | null = null) {
    if (roadmap && !this.canEditRoadmap(roadmap)) {
      return;
    }

    if (!roadmap && !this.canCreateRoadmap) {
      return;
    }

    this.roadmapSaveError = '';
    this.editingRoadmapId = roadmap?.id || null;
    this.roadmapForm = roadmap
      ? {
          title: roadmap.title || '',
          description: roadmap.description || '',
          level: this.normalizeLevel(roadmap.level),
          isPublic: roadmap.isPublic === true
        }
      : this.createDefaultRoadmapForm();

    this.isRoadmapModalOpen = true;
    this.cdr.detectChanges();
  }

  closeRoadmapModal() {
    this.isRoadmapModalOpen = false;
    this.isSavingRoadmap = false;
    this.roadmapSaveError = '';
    this.editingRoadmapId = null;
    this.roadmapForm = this.createDefaultRoadmapForm();
    this.cdr.detectChanges();
  }

  saveRoadmap() {
    if (this.isSavingRoadmap) {
      return;
    }

    if (!this.roadmapForm.title.trim()) {
      this.roadmapSaveError = 'Vui lòng nhập tiêu đề lộ trình.';
      this.cdr.detectChanges();
      return;
    }

    const payload = {
      title: this.roadmapForm.title.trim(),
      description: this.roadmapForm.description.trim() || null,
      level: this.normalizeLevel(this.roadmapForm.level),
      isPublic: this.roadmapForm.isPublic
    };

    this.isSavingRoadmap = true;
    this.roadmapSaveError = '';

    const request$ = this.isEditingRoadmap && this.editingRoadmapId
      ? this.roadmapService.updateRoadmap(this.editingRoadmapId, payload)
      : this.roadmapService.createRoadmap(payload);

    request$.subscribe({
      next: (roadmap) => {
        const targetId = roadmap?.id || this.editingRoadmapId || undefined;
        this.closeRoadmapModal();
        this.loadUserRoadmaps(targetId);
      },
      error: (err) => {
        this.isSavingRoadmap = false;
        this.roadmapSaveError = this.getApiError(err, 'Không thể lưu lộ trình. Vui lòng thử lại.');
        this.cdr.detectChanges();
      }
    });
  }

  deleteRoadmap(roadmap: any, event?: Event) {
    event?.stopPropagation();

    if (!this.canDeleteRoadmap(roadmap)) {
      return;
    }

    if (!confirm(`Xóa lộ trình "${roadmap?.title || 'này'}"?`)) {
      return;
    }

    this.roadmapService.deleteRoadmap(roadmap.id).subscribe({
      next: () => {
        const nextActiveId = this.activeRoadmap?.id === roadmap.id ? undefined : this.activeRoadmap?.id;
        this.loadUserRoadmaps(nextActiveId);
      },
      error: (err) => {
        this.loadError = this.getApiError(err, 'Không thể xóa lộ trình.');
        this.cdr.detectChanges();
      }
    });
  }

  openItemModal() {
    if (!this.activeRoadmap || !this.canEditRoadmap(this.activeRoadmap)) {
      return;
    }

    this.itemSaveError = '';
    this.itemForm = this.createDefaultItemForm();
    this.itemForm.orderIndex = this.roadmapNodes.length;
    this.itemOptions = [];
    this.isItemModalOpen = true;
    this.loadItemOptions();
    this.cdr.detectChanges();
  }

  closeItemModal() {
    this.isItemModalOpen = false;
    this.isSavingItem = false;
    this.itemSaveError = '';
    this.itemForm = this.createDefaultItemForm();
    this.itemOptions = [];
    this.cdr.detectChanges();
  }

  onItemTypeChange() {
    this.itemForm.topicId = '';
    this.itemForm.quizSetId = '';
    this.itemForm.problemId = '';
    this.itemForm.problemBankId = '';
    this.itemOptions = [];
    this.loadItemOptions();
  }

  get selectedItemRefId(): string {
    switch (this.itemForm.itemType) {
      case 'quiz_set': return this.itemForm.quizSetId;
      case 'problem': return this.itemForm.problemId;
      case 'problem_bank': return this.itemForm.problemBankId;
      default: return this.itemForm.topicId;
    }
  }

  setSelectedItemRefId(id: string) {
    switch (this.itemForm.itemType) {
      case 'quiz_set': this.itemForm.quizSetId = id; break;
      case 'problem': this.itemForm.problemId = id; break;
      case 'problem_bank': this.itemForm.problemBankId = id; break;
      default: this.itemForm.topicId = id; break;
    }
  }

  saveItem() {
    if (this.isSavingItem || !this.activeRoadmap) {
      return;
    }

    if (!this.selectedItemRefId) {
      this.itemSaveError = 'Vui lòng chọn nội dung cho mục học này.';
      this.cdr.detectChanges();
      return;
    }

    const payload: any = {
      itemType: this.itemForm.itemType,
      topicId: this.itemForm.itemType === 'topic' ? this.itemForm.topicId : null,
      quizSetId: this.itemForm.itemType === 'quiz_set' ? this.itemForm.quizSetId : null,
      problemId: this.itemForm.itemType === 'problem' ? this.itemForm.problemId : null,
      problemBankId: this.itemForm.itemType === 'problem_bank' ? this.itemForm.problemBankId : null,
      orderIndex: this.itemForm.orderIndex,
      isRequired: this.itemForm.isRequired
    };

    if (this.itemForm.itemType === 'quiz_set') {
      payload.passThreshold = this.itemForm.passThreshold;
    }

    this.isSavingItem = true;
    this.itemSaveError = '';

    this.roadmapService.addItem(this.activeRoadmap.id, payload).subscribe({
      next: () => {
        this.closeItemModal();
        this.loadUserRoadmaps(this.activeRoadmap.id);
      },
      error: (err) => {
        this.isSavingItem = false;
        this.itemSaveError = this.getApiError(err, 'Không thể thêm mục học. Vui lòng thử lại.');
        this.cdr.detectChanges();
      }
    });
  }

  removeItem(item: any, event?: Event) {
    event?.stopPropagation();

    if (!this.activeRoadmap || !this.canEditRoadmap(this.activeRoadmap) || !item?.itemId) {
      return;
    }

    if (!confirm(`Xóa mục học "${item?.name || 'này'}"?`)) {
      return;
    }

    this.roadmapService.removeItem(this.activeRoadmap.id, item.itemId).subscribe({
      next: () => this.loadUserRoadmaps(this.activeRoadmap.id),
      error: (err) => {
        this.loadError = this.getApiError(err, 'Không thể xóa mục học.');
        this.cdr.detectChanges();
      }
    });
  }

  private loadItemOptions() {
    this.isLoadingItemOptions = true;
    const endpoint = this.getItemOptionsEndpoint(this.itemForm.itemType);

    this.http.get<any>(endpoint).subscribe({
      next: (res) => {
        const data = res?.data?.items || res?.data || res?.items || res || [];
        this.itemOptions = Array.isArray(data) ? data : [];
        this.isLoadingItemOptions = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.itemOptions = [];
        this.isLoadingItemOptions = false;
        this.cdr.detectChanges();
      }
    });
  }

  private getItemOptionsEndpoint(type: string): string {
    switch (type) {
      case 'quiz_set': return '/api/quiz-sets';
      case 'problem': return '/api/problems';
      case 'problem_bank': return '/api/problem-banks';
      default: return '/api/topics';
    }
  }

  private createDefaultItemForm(): ItemFormState {
    return {
      itemType: 'topic',
      topicId: '',
      quizSetId: '',
      problemId: '',
      problemBankId: '',
      orderIndex: 0,
      isRequired: true,
      passThreshold: 90
    };
  }

  getLevelName(level: string): string {
    const normalizedLevel = this.normalizeLevel(level);
    if (normalizedLevel === 'beginner') return 'Cơ bản';
    if (normalizedLevel === 'advanced') return 'Nâng cao';
    return 'Trung cấp';
  }

  getRoadmapItemCount(roadmap: any): number {
    const items = Array.isArray(roadmap?.items) ? roadmap.items : [];
    const topics = Array.isArray(roadmap?.topics) ? roadmap.topics : [];
    return items.length || topics.length;
  }

  getReviewStatusLabel(reviewStatus: string | null | undefined): string {
    switch ((reviewStatus || '').toLowerCase()) {
      case 'approved':
        return 'Đã duyệt';
      case 'rejected':
        return 'Bị từ chối';
      default:
        return 'Chờ duyệt';
    }
  }

  getReviewStatusClass(reviewStatus: string | null | undefined): string {
    switch ((reviewStatus || '').toLowerCase()) {
      case 'approved':
        return 'is-approved';
      case 'rejected':
        return 'is-rejected';
      default:
        return 'is-pending';
    }
  }

  getVisibilityLabel(roadmap: any): string {
    return roadmap?.isPublic ? 'Công khai' : 'Riêng tư';
  }

  private loadViewerContext() {
    const token = typeof window !== 'undefined'
      ? localStorage.getItem('accessToken') || localStorage.getItem('token')
      : null;

    if (!token) {
      return;
    }

    this.http.get<any>('/api/users/me').subscribe({
      next: (res) => {
        const user = res?.data || res;
        this.currentUserId = (user?.id || '').toString().toLowerCase();
        this.cdr.detectChanges();
      }
    });
  }

  isOwnRoadmap(roadmap: any): boolean {
    return Boolean(this.currentUserId) && roadmap?.createdBy === this.currentUserId;
  }

  private pickActiveRoadmap(roadmaps: any[], preferredRoadmapId?: string | null) {
    if (!Array.isArray(roadmaps) || roadmaps.length === 0) {
      return null;
    }

    if (preferredRoadmapId) {
      const matched = roadmaps.find(roadmap => roadmap.id === preferredRoadmapId);
      if (matched) {
        return matched;
      }
    }

    return roadmaps[0];
  }

  private buildNodes(roadmap: any): RoadmapNode[] {
    const items = Array.isArray(roadmap?.items) ? roadmap.items : [];

    if (items.length) {
      return items
        .slice()
        .sort((a: any, b: any) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
        .map((item: any, index: number) => this.mapItemNode(item, index, roadmap?.id));
    }

    const topics = Array.isArray(roadmap?.topics) ? roadmap.topics : [];
    return topics
      .slice()
      .sort((a: any, b: any) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
      .map((topic: any, index: number) => ({
        stepNum: index + 1,
        itemId: null,
        id: topic.topicId,
        name: topic.name || 'Chủ đề kiến thức',
        desc: `Hệ thống hóa kiến thức trọng tâm và luyện tập theo chủ đề ${topic.name || 'này'}.`,
        icon: 'bi-journal-code',
        type: 'topic',
        typeLabel: 'Chủ đề',
        isRequired: true,
        completed: false,
        status: 'available',
        route: ['/quiz-bank'],
        queryParams: null
      }));
  }

  private mapItemNode(item: any, index: number, roadmapId?: string): RoadmapNode {
    const type = item.itemType || 'topic';
    const id = item.topicId || item.quizSetId || item.problemId || item.problemBankId || null;

    return {
      stepNum: index + 1,
      itemId: item.id || null,
      id,
      name: item.title || 'Mục học tập',
      desc: item.description || this.defaultDescription(type),
      icon: this.getItemIcon(type),
      type,
      typeLabel: this.getItemTypeLabel(type),
      isRequired: item.isRequired !== false,
      completed: Boolean(item.completed),
      status: id ? 'available' : 'empty',
      route: this.getItemRoute(type, id),
      queryParams: roadmapId ? this.getItemQueryParams(roadmapId, item.id || null) : null
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

  private getItemQueryParams(roadmapId: string, itemId: string | null): any {
    return itemId ? { roadmapId, roadmapItemId: itemId } : null;
  }

  private defaultDescription(type: string): string {
    switch (type) {
      case 'quiz_set': return 'Làm bộ đề để kiểm tra mức độ nắm kiến thức trong chặng này.';
      case 'problem': return 'Giải bài code để rèn kỹ năng triển khai và tư duy thuật toán.';
      case 'problem_bank': return 'Hoàn thành nhóm bài code theo cùng một mục tiêu luyện tập.';
      default: return 'Ôn tập kiến thức nền và chuẩn bị cho các chặng tiếp theo.';
    }
  }

  private normalizeLevel(level: string): string {
    const normalizedLevel = (level || '').trim().toLowerCase();
    if (normalizedLevel === 'cơ bản' || normalizedLevel === 'co ban' || normalizedLevel === 'beginner') {
      return 'beginner';
    }

    if (normalizedLevel === 'nâng cao' || normalizedLevel === 'nang cao' || normalizedLevel === 'advanced' || normalizedLevel === 'hard') {
      return 'advanced';
    }

    return 'intermediate';
  }

  private createDefaultRoadmapForm(): RoadmapFormState {
    return {
      title: '',
      description: '',
      level: 'intermediate',
      isPublic: false
    };
  }

  private getApiError(err: any, fallback: string): string {
    const validationErrors = err?.error?.errors;
    if (validationErrors && typeof validationErrors === 'object') {
      const firstError = Object.values(validationErrors).flat().find(Boolean);
      if (firstError) {
        return String(firstError);
      }
    }

    return err?.error?.message || err?.message || fallback;
  }
}
