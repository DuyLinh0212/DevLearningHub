import { Component, ChangeDetectorRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({ selector:'app-feedback-management', standalone:true, imports:[CommonModule, FormsModule], templateUrl:'./feedback-management.html', styleUrl:'./feedback-management.css' })
export class FeedbackManagementComponent implements OnInit {
  private http=inject(HttpClient); private cdr=inject(ChangeDetectorRef); items:any[]=[]; filter=''; loading=false; selected:any=null; response=''; status='in_progress';
  ngOnInit(){this.load()}
  load(){this.loading=true;const q=this.filter?`?status=${encodeURIComponent(this.filter)}`:'';this.http.get<any>('/api/feedback/admin'+q).subscribe({next:r=>{this.items=r?.data||r||[];this.loading=false;this.cdr.detectChanges()},error:()=>{this.items=[];this.loading=false;this.cdr.detectChanges()}})}
  select(item:any){this.selected=item;this.response=item.adminResponse||'';this.status=item.status}
  save(){if(!this.selected)return;this.http.patch(`/api/feedback/${this.selected.id}`,{status:this.status,adminResponse:this.response}).subscribe({next:()=>{this.selected=null;this.load()}})}
}
