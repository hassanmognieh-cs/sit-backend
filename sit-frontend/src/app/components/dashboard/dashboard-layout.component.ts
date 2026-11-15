import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { LowStockAlertComponent } from './low-stock-alert.component';

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, LowStockAlertComponent],
  templateUrl: './dashboard-layout.component.html',
  styleUrls: ['./dashboard-layout.component.css']
})
export class DashboardLayoutComponent implements OnInit {

  private auth = inject(AuthService);
  private router = inject(Router);

  role: string | null = null;
  isAdmin = false;
  isSuperAdmin = false;
  isManager = false;
  isEmployee = false;
  isDarkMode = true;

  ngOnInit() {
    const saved = localStorage.getItem('theme');
    this.isDarkMode = saved ? saved === 'dark' : true;
    document.documentElement.setAttribute('data-theme', this.isDarkMode ? 'dark' : 'light');

    this.auth.role$.subscribe(role => {
      this.role = role;
      this.isAdmin = role === 'admin';
      this.isSuperAdmin = role === 'superadmin';
      this.isManager = role === 'manager';
      this.isEmployee = role === 'employee';
    });
  }

  toggleTheme(event?: Event) {
    if (event) event.preventDefault();
    this.isDarkMode = !this.isDarkMode;
    const theme = this.isDarkMode ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }

  logout(event?: Event) {
    if (event) event.preventDefault();

    // Navigate to logout confirmation page
    this.router.navigate(['/logout-confirmation']);
  }
}
