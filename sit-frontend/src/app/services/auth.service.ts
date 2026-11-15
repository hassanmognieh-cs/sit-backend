import { from } from 'rxjs';
import { Injectable, inject, EnvironmentInjector } from '@angular/core';
import {
  Auth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  User,
  signOut,
  sendEmailVerification,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from '@angular/fire/auth';

import {
  Firestore,
  doc,
  getDoc,
  getDocFromServer,
} from '@angular/fire/firestore';

import { BehaviorSubject } from 'rxjs';
import { UserService } from './users.service';

export type AuthEnforcementState =
  | 'checking'
  | 'signed_out'
  | 'must_change_password'
  | 'ready';

@Injectable({ providedIn: 'root' })
export class AuthService {

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private userService = inject(UserService);

  // The correct injector for running Firebase APIs safely
  private injector = inject(EnvironmentInjector);

  user$ = new BehaviorSubject<User | null>(null);
  role$ = new BehaviorSubject<string | null>(null);
  userData$ = new BehaviorSubject<any | null>(null);
  authInitialized$ = new BehaviorSubject<boolean>(false);
  enforcementState$ = new BehaviorSubject<AuthEnforcementState>('checking');
  authMessage$ = new BehaviorSubject<string>('');

  currentEmail: string | null = null;
  currentPassword: string | null = null;

  private enforcementInFlight: Promise<AuthEnforcementState> | null = null;

  constructor() {

    // Listen to Firebase login state changes
    onAuthStateChanged(this.auth, async (user) => {
      this.user$.next(user);

      if (!user) {
        this.role$.next(null);
        this.userData$.next(null);
        this.enforcementState$.next('signed_out');
        this.authInitialized$.next(true);
        return;
      }

      try {
        this.authInitialized$.next(true);
        await this.enforcePostAuthChecks('restore');
      } catch (e) {
        console.error("Error enforcing auth checks:", e);
        this.role$.next(null);
        this.userData$.next(null);
        this.enforcementState$.next('signed_out');
      }
    });
  }

  // -------------------------------------------------------
  // LOGIN
  // -------------------------------------------------------
  login(email: string, password: string) {
  this.currentEmail = email;
  this.currentPassword = password;

  return from(signInWithEmailAndPassword(this.auth, email, password));
}


  // -------------------------------------------------------
  // LOGOUT
  // -------------------------------------------------------
  logout() {
    this.currentEmail = null;
    this.currentPassword = null;
    this.role$.next(null);
    this.userData$.next(null);
    this.enforcementState$.next('signed_out');
    return from(signOut(this.auth));
  }

  // -------------------------------------------------------
  // FETCH USER ROLE SAFELY
  // -------------------------------------------------------
  async getUserRole(): Promise<string | null> {
    const user = this.auth.currentUser;
    if (!user) return null;

    return this.injector.runInContext(async () => {
      const ref = doc(this.firestore, 'users', user.uid);
      const snap = await getDoc(ref);

      if (!snap.exists()) return null;

      const data = snap.data() as any;
      return data.role?.trim().toLowerCase() ?? null;
    });
  }

  // -------------------------------------------------------
  // GET FRESH JWT TOKEN SAFELY
  // -------------------------------------------------------
  async getFreshToken(): Promise<string> {
    try {
      const user = this.auth.currentUser;
      if (!user) {
        console.warn('[AuthService] No current user for token retrieval');
        return '';
      }

      return await this.injector.runInContext(async () => {
        try {
          // Try to get a fresh token (force refresh)
          return await user.getIdToken(true);
        } catch (error: any) {
          console.error('[AuthService] Error getting fresh token, trying cached token:', error);
          // If fresh token fails (e.g., network error), try cached token
          try {
            return await user.getIdToken(false);
          } catch (cachedError: any) {
            console.error('[AuthService] Error getting cached token:', cachedError);
            // If both fail, return empty string - the request will proceed without auth header
            return '';
          }
        }
      });
    } catch (error: any) {
      console.error('[AuthService] Unexpected error in getFreshToken:', error);
      return '';
    }
  }

  // -------------------------------------------------------
  // GET USER DATA FROM FIRESTORE
  // -------------------------------------------------------
  async getUserData(): Promise<any | null> {
    const user = this.auth.currentUser;
    if (!user) return null;

    return this.injector.runInContext(async () => {
      const ref = doc(this.firestore, 'users', user.uid);
      const snap = await getDoc(ref);

      if (!snap.exists()) return null;

      return snap.data();
    });
  }

  async getUserDataFromServer(): Promise<any | null> {
    const user = this.auth.currentUser;
    if (!user) return null;

    return this.injector.runInContext(async () => {
      const ref = doc(this.firestore, 'users', user.uid);
      const snap = await getDocFromServer(ref);

      if (!snap.exists()) return null;
      return snap.data();
    });
  }

  // -------------------------------------------------------
  // CHECK EMAIL VERIFICATION
  // -------------------------------------------------------
  async isEmailVerified(): Promise<boolean> {
    const user = this.auth.currentUser;
    return user?.emailVerified ?? false;
  }

  // -------------------------------------------------------
  // SEND EMAIL VERIFICATION
  // -------------------------------------------------------
  async sendVerificationEmail(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('No user logged in');

    return this.injector.runInContext(async () => {
      await sendEmailVerification(user);
    });
  }

  // -------------------------------------------------------
  // CHECK ACCOUNT STATUS
  // -------------------------------------------------------
  async getAccountStatus(): Promise<'active' | 'disabled' | null> {
    const userData = await this.getUserData();
    if (!userData) return null;

    return (userData.status as 'active' | 'disabled') ?? 'active';
  }

  // -------------------------------------------------------
  // CHECK FORCE PASSWORD CHANGE
  // -------------------------------------------------------
  async requiresPasswordChange(): Promise<boolean> {
    const userData = await this.getUserData();
    if (!userData) return false;

    return userData.forcePasswordChange === true;
  }

  // -------------------------------------------------------
  // CLEAR / SET AUTH MESSAGE (used by Login UI)
  // -------------------------------------------------------
  setAuthMessage(message: string) {
    this.authMessage$.next(message);
  }

  clearAuthMessage() {
    this.authMessage$.next('');
  }

  // -------------------------------------------------------
  // ENFORCE POST-AUTH CHECKS (login + restore + guards)
  // Order: emailVerified -> Firestore status -> forcePasswordChange
  // -------------------------------------------------------
  async enforcePostAuthChecks(trigger: 'login' | 'restore' | 'guard'): Promise<AuthEnforcementState> {
    if (this.enforcementInFlight) return this.enforcementInFlight;

    this.enforcementInFlight = this._enforcePostAuthChecks(trigger)
      .finally(() => {
        this.enforcementInFlight = null;
      });

    return this.enforcementInFlight;
  }

  private async _enforcePostAuthChecks(_trigger: 'login' | 'restore' | 'guard'): Promise<AuthEnforcementState> {
    const user = this.auth.currentUser;
    if (!user) {
      this.role$.next(null);
      this.userData$.next(null);
      this.enforcementState$.next('signed_out');
      return 'signed_out';
    }

    this.enforcementState$.next('checking');

    // Refresh emailVerified on restore/login
    try {
      await user.reload();
    } catch (e) {
      // ignore reload errors; we still proceed with current snapshot
    }

    // 1) Email verification enforcement
    if (!user.emailVerified) {
      try {
        // Explicitly send verification email using the current Firebase user
        const currentUser = this.auth.currentUser;
        if (currentUser) {
          await this.injector.runInContext(async () => {
            await sendEmailVerification(currentUser);
          });
        }
      } catch (e) {
        // ignore (quota, too-many-requests, etc.)
      }

      this.setAuthMessage('Please verify your email');
      await signOut(this.auth);
      this.role$.next(null);
      this.userData$.next(null);
      this.enforcementState$.next('signed_out');
      return 'signed_out';
    }

    // 2) Firestore user doc + account status enforcement (server-read to avoid stale cache)
    const userData = await this.getUserDataFromServer();
    if (!userData) {
      this.setAuthMessage('Your account is disabled');
      await signOut(this.auth);
      this.role$.next(null);
      this.userData$.next(null);
      this.enforcementState$.next('signed_out');
      return 'signed_out';
    }

    const status = (userData.status ?? 'active') as string;
    if (String(status).toLowerCase() !== 'active') {
      this.setAuthMessage('Your account is disabled');
      await signOut(this.auth);
      this.role$.next(null);
      this.userData$.next(null);
      this.enforcementState$.next('signed_out');
      return 'signed_out';
    }

    // Store role + user data centrally (RoleGuard will rely on this)
    this.userData$.next(userData);
    this.role$.next(userData.role?.trim().toLowerCase?.() ?? null);

    // 3) Force password change enforcement
    console.log('[AuthEnforce] forcePasswordChange =', userData.forcePasswordChange, 'uid =', user.uid);
    if (userData.forcePasswordChange === true) {
      this.enforcementState$.next('must_change_password');
      return 'must_change_password';
    }

    this.clearAuthMessage();
    this.enforcementState$.next('ready');
    return 'ready';
  }

  // -------------------------------------------------------
  // UPDATE PASSWORD
  // -------------------------------------------------------
  /**
   * First-login password change: try updating password directly (no current password).
   * If Firebase requires recent login, the caller should prompt for current password
   * and then call updatePasswordWithReauth().
   */
  async updatePasswordDirect(newPassword: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('No user logged in');

    return this.injector.runInContext(async () => {
      console.log('[PasswordChange] updatePasswordDirect: starting, uid =', user.uid);
      try {
        await updatePassword(user, newPassword);
      } catch (e: any) {
        // If Firebase requires a recent login, try reauth automatically using the password
        // the user just logged in with (no extra UI field).
        if (e?.code === 'auth/requires-recent-login' && this.currentPassword) {
          console.log('[PasswordChange] requires-recent-login; retrying with reauth using stored login password', { uid: user.uid });
          await this.updatePasswordWithReauth(this.currentPassword, newPassword);
          this.currentPassword = newPassword;
          return;
        }
        throw e;
      }

      console.log('[PasswordChange] Password updated', { uid: user.uid });
      this.currentPassword = newPassword;
    });
  }

  /**
   * Fallback when Firebase returns auth/requires-recent-login.
   */
  async updatePasswordWithReauth(currentPassword: string, newPassword: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user || !user.email) throw new Error('No user logged in');

    return this.injector.runInContext(async () => {
      console.log('[PasswordChange] updatePasswordWithReauth: starting, uid =', user.uid);
      const credential = EmailAuthProvider.credential(user.email!, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      console.log('[PasswordChange] Password updated', { uid: user.uid });
    });
  }

  /**
   * Clear users/{uid}.forcePasswordChange=false AFTER password update succeeds.
   * This uses the backend (Admin SDK) so we don't weaken Firestore rules.
   */
  async clearForcePasswordChangeFlag(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('No user logged in');

    return this.injector.runInContext(async () => {
      const uid = user.uid;
      console.log('[PasswordChange] calling backend /api/account/clear-force-password-change', { uid });
      await this.userService.clearForcePasswordChangeViaBackend();
      console.log('[PasswordChange] forcePasswordChange cleared (backend)', { uid });

      // Verify from server to prevent redirect loops due to stale reads or failed writes.
      const ref = doc(this.firestore, 'users', uid);
      const snap = await getDocFromServer(ref);
      const updatedData = snap.exists() ? snap.data() : null;

      this.userData$.next(updatedData);
      console.log('[PasswordChange] forcePasswordChange cleared: server-read =', updatedData?.['forcePasswordChange'], { uid });

      if (updatedData?.['forcePasswordChange'] === true) {
        throw new Error('forcePasswordChange is still true after clearing; Firestore update did not persist');
      }

      this.enforcementState$.next('ready');
      console.log('[PasswordChange] forcePasswordChange cleared', { uid });
    });
  }
}
