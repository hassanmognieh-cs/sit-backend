import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PasswordGenerator } from '../../utils/password-generator.util';
import { firstValueFrom } from 'rxjs';
import { Auth } from '@angular/fire/auth';
import { Firestore, doc, updateDoc } from '@angular/fire/firestore';
import { UserService } from '../../services/users.service';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './change-password.component.html',
  styleUrls: ['./change-password.component.css']
})
export class ChangePasswordComponent implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private afAuth = inject(Auth);
  private firestore = inject(Firestore);
  private userService = inject(UserService);
  private router = inject(Router);

  form: FormGroup;
  loading = false;
  errorMessage = '';
  successMessage = '';
  warningMessage = '';

  passwordErrors: string[] = [];
  passwordChecklist = {
    minLength: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false
  };

  constructor() {
    this.form = this.fb.group({
      newPassword: ['', [Validators.required, this.strongPasswordValidator]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  async ngOnInit() {
    // If the user already cleared forcePasswordChange, don't show this page again.
    const enforcement = await this.auth.enforcePostAuthChecks('guard');
    if (enforcement === 'ready') {
      this.router.navigate(['/dashboard']);
    } else if (enforcement === 'signed_out') {
      this.router.navigate(['/login']);
    }
  }

  // Strong password validator
  strongPasswordValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;

    const validation = PasswordGenerator.validateStrongPassword(control.value);
    return validation.valid ? null : { weakPassword: true };
  }

  // Password match validator
  passwordMatchValidator(form: AbstractControl): ValidationErrors | null {
    const newPassword = form.get('newPassword')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;

    if (!newPassword || !confirmPassword) return null;

    return newPassword === confirmPassword ? null : { passwordMismatch: true };
  }

  // Get password validation errors
  getPasswordErrors(): string[] {
    const newPassword = this.form.get('newPassword')?.value;
    if (!newPassword) return [];

    const validation = PasswordGenerator.validateStrongPassword(newPassword);
    return validation.errors;
  }

  // Check if password is being validated
  onPasswordInput() {
    const newPassword: string = this.form.get('newPassword')?.value ?? '';

    if (!newPassword) {
      this.passwordErrors = [];
      this.passwordChecklist = {
        minLength: false,
        uppercase: false,
        lowercase: false,
        number: false,
        special: false
      };
      return;
    }

    const validation = PasswordGenerator.validateStrongPassword(newPassword);
    this.passwordErrors = validation.errors;

    this.passwordChecklist = {
      minLength: newPassword.length >= 8,
      uppercase: /[A-Z]/.test(newPassword),
      lowercase: /[a-z]/.test(newPassword),
      number: /[0-9]/.test(newPassword),
      special: /[@#$%&*!]/.test(newPassword)
    };
  }

  async onSubmit() {
    if (this.form.invalid) {
      this.errorMessage = 'Please fix all errors before submitting.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.warningMessage = '';
    this.auth.clearAuthMessage();

    const { newPassword } = this.form.value;

    let passwordUpdated = false;

    // Validate new password strength
    const validation = PasswordGenerator.validateStrongPassword(newPassword);
    if (!validation.valid) {
      this.errorMessage = validation.errors.join('. ');
      this.loading = false;
      return;
    }

    // 1) Wrap ONLY updatePassword() in try/catch.
    try {
      // First-login flow: only set new password (no current password prompt).
      await this.auth.updatePasswordDirect(newPassword);
      passwordUpdated = true;
      console.log('updatePassword success');
      // Password is changed at this point; show success ONLY for password.
      this.successMessage = 'Password changed successfully.';
    } catch (error: any) {
      console.error('Password change error:', error);
      console.error('Password change error details:', { code: error?.code, message: error?.message });

      // Only show error if updatePassword itself fails.
      this.successMessage = '';
      this.warningMessage = '';
      if (error?.code === 'auth/requires-recent-login') {
        this.errorMessage = 'Session expired. Please log out and log in again, then change your password once.';
      } else if (error?.code === 'auth/weak-password') {
        this.errorMessage = 'New password is too weak.';
      } else {
        this.errorMessage = 'Failed to change password. Please try again.';
      }
      this.loading = false;
      return;
    }

    // 2) After updatePassword succeeds, update Firestore users/{uid}.forcePasswordChange=false
    // Do NOT navigate or return before updateDoc completes.
    const currentUser = await this.afAuth.currentUser;

    if (!currentUser) {
      // Password updated already; don't claim it failed.
      this.warningMessage = 'We could not update your account settings. Please log in again.';
      this.loading = false;
      return;
    }

    try {
      const ref = doc(this.firestore, 'users', currentUser.uid);
      await updateDoc(ref, { forcePasswordChange: false });
      console.log('forcePasswordChange updated');
    } catch (flagErr: any) {
      console.error('forcePasswordChange update error:', flagErr);
      console.error('forcePasswordChange update error details:', { code: flagErr?.code, message: flagErr?.message });

      const code = flagErr?.code as string | undefined;
      // If Firestore rules block client writes, clear via backend (Admin SDK) instead.
      if (code === 'permission-denied' || code === 'firestore/permission-denied') {
        try {
          console.log('[PasswordChange] permission-denied updating users/{uid}; calling backend clear-force-password-change');
          await this.userService.clearForcePasswordChangeViaBackend();
          console.log('forcePasswordChange updated');
        } catch (backendErr: any) {
          console.error('[PasswordChange] backend clear-force-password-change failed', backendErr);
          // Password update was successful; do NOT indicate password failure.
          this.warningMessage = 'We could not finalize your account update. Please try again in a moment.';
          this.loading = false;
          return;
        }
      } else {
        // Password update was successful; do NOT indicate password failure.
        this.warningMessage = 'We could not finalize your account update. Please try again in a moment.';
        this.loading = false;
        return;
      }
    }

    // 3) Only redirect AFTER updateDoc resolves successfully.
    this.successMessage = 'Password changed successfully! Redirecting...';
    await this.auth.enforcePostAuthChecks('guard');
    await new Promise(resolve => setTimeout(resolve, 900));
    this.router.navigate(['/dashboard']);

    this.loading = false;
  }
}

