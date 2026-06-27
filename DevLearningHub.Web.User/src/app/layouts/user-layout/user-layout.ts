import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TopbarComponent } from '../../shared/components/topbar/topbar';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar';

@Component({
  selector: 'app-user-layout',
  standalone: true,
  imports: [RouterOutlet, TopbarComponent, SidebarComponent],
  templateUrl: './user-layout.html',
  styleUrl: './user-layout.css'
})
export class UserLayoutComponent {}
