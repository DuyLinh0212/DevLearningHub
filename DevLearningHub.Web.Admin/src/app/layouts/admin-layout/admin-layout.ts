import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AdminTopbarComponent } from '../../shared/components/topbar/topbar';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, AdminTopbarComponent, SidebarComponent],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.css'
})
export class AdminLayoutComponent {}
