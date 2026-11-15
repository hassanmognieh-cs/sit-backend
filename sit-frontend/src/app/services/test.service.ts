import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class TestService {

  private auth = inject(AuthService);

  async testSecureEndpoint() {
    // Get token safely inside Angular DI
    const token = await this.auth.getFreshToken();

    if (!token) {
      throw new Error('No authentication token available. Please login first.');
    }

    const response = await fetch(`${environment.apiBase}/api/test/secure`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    return response.json();
  }
}
