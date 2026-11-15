import { Component, DestroyRef, inject } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {

  private fb = inject(FormBuilder);
  auth = inject(AuthService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });

  message = '';
  loading = false;
  showPassword = false;

  constructor() {
    // If a guard/enforcement signs the user out, show the reason on the login page.
    this.auth.authMessage$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(msg => {
        if (msg) this.message = msg;
      });
  }

  async onSubmit() {
    if (this.form.invalid) return;

    this.loading = true;
    this.message = '';
    this.auth.clearAuthMessage();

    const { email, password } = this.form.value;

    try {
      // 1) Firebase sign-in
      await firstValueFrom(this.auth.login(email!, password!));

      // 2) Enforce email verification -> status -> forcePasswordChange
      const enforcement = await this.auth.enforcePostAuthChecks('login');

      // Enforcement may sign the user out and set an auth message
      if (enforcement === 'signed_out') {
        this.message = this.auth.authMessage$.value || 'Login blocked.';
        return;
      }

      if (enforcement === 'must_change_password') {
        this.router.navigate(['/change-password']);
        return;
      }

      // 3) Ready
      this.router.navigate(['/dashboard']);

    } catch (err: any) {
      console.error(err);
      
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        this.message = 'Invalid email or password.';
      } else if (err.code === 'auth/too-many-requests') {
        this.message = 'Too many failed attempts. Please try again later.';
      } else {
        this.message = 'Invalid credentials or error connecting.';
      }
    } finally {
      this.loading = false;
    }
  }
}
