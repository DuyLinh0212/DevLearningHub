import { Component, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar';

@Component({
  selector: 'app-user-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent],
  templateUrl: './user-layout.html',
  styleUrl: './user-layout.css'
})
export class UserLayoutComponent {
  @ViewChild('sidebar') sidebar!: SidebarComponent;

  toggleSidebar() {
    if (this.sidebar) {
      this.sidebar.toggleMobileSidebar();
    }
  }
}
