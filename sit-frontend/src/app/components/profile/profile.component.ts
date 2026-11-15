import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { EnvironmentInjector } from '@angular/core';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {
  
  private auth = inject(AuthService);
  private firestore = inject(Firestore);
  private injector = inject(EnvironmentInjector);
  private fb = inject(FormBuilder);

  userEmail: string | null = null;
  userId: string | null = null;
  role: string | null = null;
  userData: any = null;
  memberSince: Date | null = null;
  
  // Change password modal
  showChangePasswordModal = false;
  changePasswordForm: FormGroup;
  passwordError: string = '';
  passwordSuccess: string = '';
  changingPassword = false;

  get roleDisplay(): string {
    if (!this.role) return 'User';
    return this.role.charAt(0).toUpperCase() + this.role.slice(1);
  }

  constructor() {
    this.changePasswordForm = this.fb.group({
      currentPassword: [''], // Optional
      newPassword: ['', [Validators.required, Validators.minLength(8), this.passwordStrengthValidator]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });
  }

  passwordStrengthValidator(control: any) {
    if (!control.value) {
      return null;
    }
    const value = control.value;
    const hasMinLength = value.length >= 8;
    const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value);
    
    if (!hasMinLength || !hasSymbol) {
      return { passwordStrength: true };
    }
    return null;
  }

  passwordMatchValidator(form: FormGroup) {
    const newPassword = form.get('newPassword');
    const confirmPassword = form.get('confirmPassword');
    if (newPassword && confirmPassword && newPassword.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    return null;
  }

  ngOnInit() {
    // Subscribe to user and role
    this.auth.user$.subscribe(user => {
      if (user) {
        this.userEmail = user.email || null;
        this.userId = user.uid;
        // Use Firebase User metadata as fallback for member since
        if (user.metadata?.creationTime) {
          this.memberSince = new Date(user.metadata.creationTime);
        }
        this.loadUserData(user.uid);
      } else {
        this.userEmail = null;
        this.userId = null;
        this.userData = null;
        this.memberSince = null;
      }
    });

    this.auth.role$.subscribe(role => {
      this.role = role;
    });
  }

  async loadUserData(uid: string) {
    try {
      const userData = await this.injector.runInContext(async () => {
        const ref = doc(this.firestore, 'users', uid);
        const snap = await getDoc(ref);
        
        if (snap.exists()) {
          return snap.data();
        }
        return null;
      });

      this.userData = userData;
      
      // Handle createdAt from Firestore (could be Timestamp or Date)
      const createdAt = userData?.['createdAt'];
      if (createdAt) {
        // Check if it's a Firestore Timestamp (has toDate method)
        if (createdAt?.toDate && typeof createdAt.toDate === 'function') {
          this.memberSince = createdAt.toDate();
        } else if (createdAt instanceof Date) {
          this.memberSince = createdAt;
        } else if (typeof createdAt === 'string' || typeof createdAt === 'number') {
          this.memberSince = new Date(createdAt);
        } else if (createdAt?.seconds) {
          // Handle Firestore Timestamp format with seconds
          this.memberSince = new Date(createdAt.seconds * 1000);
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      this.userData = null;
    }
  }

  openChangePasswordModal() {
    this.showChangePasswordModal = true;
    this.passwordError = '';
    this.passwordSuccess = '';
    this.changePasswordForm.reset();
  }

  closeChangePasswordModal() {
    this.showChangePasswordModal = false;
    this.passwordError = '';
    this.passwordSuccess = '';
    this.changePasswordForm.reset();
  }

  async onChangePassword() {
    // Check if new password and confirm password are valid
    const newPassword = this.changePasswordForm.get('newPassword')?.value;
    const confirmPassword = this.changePasswordForm.get('confirmPassword')?.value;

    if (!newPassword || newPassword.length < 8) {
      this.passwordError = 'Password must be 8 characters at least with symbols (for stronger password).';
      return;
    }

    // Check for symbol
    const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);
    if (!hasSymbol) {
      this.passwordError = 'Password must be 8 characters at least with symbols (for stronger password).';
      return;
    }

    if (newPassword !== confirmPassword) {
      this.passwordError = 'New password and confirm password do not match.';
      return;
    }

    const currentPassword = this.changePasswordForm.get('currentPassword')?.value || '';

    this.changingPassword = true;
    this.passwordError = '';
    this.passwordSuccess = '';

    try {
      // If current password is provided, use reauthentication
      if (currentPassword) {
        await this.auth.updatePasswordWithReauth(currentPassword, newPassword);
      } else {
        // Try to update password directly (may require recent login)
        try {
          await this.auth.updatePasswordDirect(newPassword);
        } catch (directError: any) {
          // If direct update fails with requires-recent-login, ask for current password
          if (directError?.code === 'auth/requires-recent-login') {
            this.passwordError = 'For security reasons, please enter your current password.';
            this.changingPassword = false;
            return;
          }
          throw directError;
        }
      }
      
      this.passwordSuccess = 'Password changed successfully!';
      
      // Clear form after success
      setTimeout(() => {
        this.closeChangePasswordModal();
      }, 2000);
    } catch (error: any) {
      console.error('Error changing password:', error);
      if (error.code === 'auth/wrong-password') {
        this.passwordError = 'Current password is incorrect.';
      } else if (error.code === 'auth/weak-password') {
        this.passwordError = 'Password must be 8 characters at least with symbols (for stronger password).';
      } else if (error.code === 'auth/requires-recent-login') {
        this.passwordError = 'For security reasons, please enter your current password.';
      } else {
        this.passwordError = error.message || 'Failed to change password. Please try again.';
      }
    } finally {
      this.changingPassword = false;
    }
  }
}

