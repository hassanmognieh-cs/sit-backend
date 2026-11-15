import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.css']
})
export class WelcomeComponent {
  constructor(private router: Router) {}

  navigateToLogin() {
    // Add fade out effect before navigation
    const container = document.querySelector('.welcome-container');
    if (container) {
      container.classList.remove('fade-in');
      container.classList.add('fade-out');
      setTimeout(() => {
        this.router.navigate(['/login']);
      }, 300);
    } else {
      this.router.navigate(['/login']);
    }
  }
}

