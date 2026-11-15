import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/users.service';//api calls
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.css']
})
export class UsersComponent implements OnInit {

  private authService = inject(AuthService);
  private userService = inject(UserService);

  users: any[] = [];
  filteredUsers: any[] = [];
  /*added*/
   searchTerm: string = '';
  roleFilter: 'all' | 'employee' | 'manager' | 'admin' = 'all';

  isAdmin = false;
  isSuperAdmin = false;

  showModal = false;
  mode: 'add' | 'edit' = 'add';
  selectedUser: any = null;

  name = '';
  email = '';
  password = '';
  role = 'employee';
  errorMessage = '';
  generatedPassword = '';
  showPasswordModal = false;

  ngOnInit() {
    this.authService.role$.subscribe(role => {
      this.isAdmin = role === 'admin';
      this.isSuperAdmin = role === 'superadmin';
    });

    this.loadUsers();
  }

  // LOAD USERS
  async loadUsers() {
    try {
      const allUsers = await firstValueFrom(this.userService.getAllUsers());
      this.users = allUsers.map((u: any) => ({
        ...u,
        status: u.status ?? 'active'
      }));
      this.applyFilter();
    } catch (error: any) {
      console.error('Error loading users:', error);
      if (error?.code === 'permission-denied') {
        console.error('Firestore permission denied — check security rules for superadmin role');
      }
      this.users = [];
      this.filteredUsers = [];
    }
  }

  //add this 
  applyFilter() {
    const term = this.searchTerm.toLowerCase();

    let filtered = this.users.filter(u =>
      (u.email || '').toLowerCase().includes(term) ||
      (u.name || '').toLowerCase().includes(term) ||
      (u.role || '').toLowerCase().includes(term)
    );

    // Filter by role
    if (this.roleFilter !== 'all') {
      filtered = filtered.filter(u => u.role === this.roleFilter);
    } else {
      // For admin: only show employee and manager (exclude admin)
      // For superadmin: show all roles except superadmin
      if (this.isAdmin) {
        filtered = filtered.filter(u => u.role === 'employee' || u.role === 'manager');
      } else if (this.isSuperAdmin) {
        filtered = filtered.filter(u => u.role !== 'superadmin');
      }
    }

    // Sort by role: managers first, then employees
    filtered = filtered.sort((a, b) => {
      if (a.role === 'manager' && b.role === 'employee') return -1;
      if (a.role === 'employee' && b.role === 'manager') return 1;
      return 0;
    });

    this.filteredUsers = (this.isAdmin || this.isSuperAdmin) ? filtered : [];
  }

  onRoleFilterChange() {
    this.applyFilter();
  }


  // OPEN ADD USER MODAL
  openAddUser() {
    if (!this.isAdmin && !this.isSuperAdmin) return;
    this.mode = 'add';
    this.name = '';
    this.email = '';
    this.password = '';
    this.role = 'employee';
    this.errorMessage = '';
    this.generatedPassword = '';
    this.showPasswordModal = false;
    this.showModal = true;
  }

  // OPEN EDIT MODAL
  openEditUser(user: any) {
    if (!this.isAdmin && !this.isSuperAdmin) return;
    // Admin cannot edit admin users, but superadmin can
    if (user.role === 'admin' && !this.isSuperAdmin) return;
    if (user.role === 'superadmin') return;

    this.mode = 'edit';
    this.selectedUser = user;
    this.name = user.name || '';
    this.email = user.email;
    this.role = user.role;
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  // SUBMIT ADD / EDIT
  async submitForm() {
    if (!this.isAdmin && !this.isSuperAdmin) return;
    this.errorMessage = '';

    if (this.mode === 'add') {
      const ok = await this.addUser();
      if (ok) {
        this.closeModal();
        await this.loadUsers();
      }
    } else {
      try {
        await this.updateUser();
        // Close modal and refresh on success
        this.closeModal();
        await this.loadUsers();
      } catch (error) {
        // Error message already set in updateUser
        console.error('Error in submitForm:', error);
      }
    }
  }

  // ADD USER (AUTH + FIRESTORE)
  async addUser(): Promise<boolean> {
    try {
      if (!this.email.trim()) {
        this.errorMessage = 'Email is required.';
        return false;
      }

      // Backend generates the temporary password + creates Auth + Firestore (rules remain strict).
      console.log('[AdminAddUser] Calling backend /api/admin/create-user');
      const res = await this.userService.adminCreateUser({
        email: this.email.trim(),
        name: this.name.trim() || this.email.trim(),
        role: this.role as 'employee' | 'manager' | 'admin'
      });
      console.log('[AdminAddUser] Backend created user', { uid: res.uid });

      this.generatedPassword = res.temporaryPassword;
      this.password = this.generatedPassword;

      // Only AFTER Firestore write succeeds: show generated password
      this.showModal = false;
      this.showPasswordModal = true;

      return true;

    } catch (error: any) {
      console.error(error);

      const status = (error as HttpErrorResponse)?.status;
      const apiCode = (error as HttpErrorResponse)?.error?.code as string | undefined;
      const apiMessage = (error as HttpErrorResponse)?.error?.message as string | undefined;

      if (status === 409 || apiCode === 'email_already_exists') {
        this.errorMessage = 'This email is already registered.';
      } else if (status === 403) {
        this.errorMessage = 'Access denied. Admin only.';
      } else if (apiMessage) {
        this.errorMessage = apiMessage;
      } else {
        this.errorMessage = 'Failed to create user.';
      }

      return false;
    }
  }

  // CLOSE PASSWORD MODAL
  closePasswordModal() {
    this.showPasswordModal = false;
    this.generatedPassword = '';
    this.password = '';
  }

  // UPDATE USER DATA via backend
  async updateUser() {
    if (!this.selectedUser?.uid) {
      this.errorMessage = 'User ID is missing.';
      throw new Error('User ID is missing');
    }

    // Validate inputs
    if (!this.email.trim()) {
      this.errorMessage = 'Email is required.';
      throw new Error('Email is required');
    }

    const uid = this.selectedUser.uid;
    console.log('[UsersComponent] Updating user - UID:', uid);
    console.log('[UsersComponent] Selected user object:', this.selectedUser);
    console.log('[UsersComponent] Users list includes this UID:', this.users.find(u => u.uid === uid) ? 'YES' : 'NO');

    try {
      console.log('[UsersComponent] Calling backend update-user API:', {
        uid: uid,
        url: `http://localhost:5011/api/admin/update-user/${uid}`,
        payload: {
          name: this.name.trim() || this.email.trim(),
          email: this.email.trim(),
          role: this.role
        }
      });

      const response = await this.userService.adminUpdateUser(uid, {
        name: this.name.trim() || this.email.trim(),
        email: this.email.trim(),
        role: this.role
      });

      console.log('[UsersComponent] User updated successfully:', response);
      // Clear any previous error messages
      this.errorMessage = '';
    } catch (error: any) {
      console.error('[UsersComponent] Error updating user - Full error:', error);
      console.error('[UsersComponent] Error status:', error?.status);
      console.error('[UsersComponent] Error error:', error?.error);
      console.error('[UsersComponent] Error URL:', error?.url);
      
      // Extract error message from different possible error formats
      let errorMessage = 'Failed to update user. Please try again.';
      
      // Handle HttpErrorResponse
      if (error && typeof error === 'object') {
        // Check for Firebase Auth network errors
        if (error.message && error.message.includes('network-request-failed')) {
          errorMessage = 'Network error: Unable to connect to Firebase. Please check your internet connection and try again.';
        }
        // Check for error.error.message (most common format)
        else if (error.error?.message) {
          errorMessage = error.error.message;
        }
        // Check for error.error (string)
        else if (typeof error.error === 'string') {
          errorMessage = error.error;
        }
        // Check for error.message
        else if (error.message) {
          if (error.message.includes('network') || error.message.includes('Network')) {
            errorMessage = 'Network error. Please check your internet connection and ensure the backend is running.';
          } else {
            errorMessage = error.message;
          }
        }
        
        // Check for specific HTTP status codes
        if (error.status === 404) {
          // 404 could mean route not found OR user not found
          if (error.error?.message) {
            errorMessage = error.error.message;
          } else {
            errorMessage = 'Route not found. Please check if the backend server is running on port 5011 and the endpoint is correct.';
          }
        } else if (error.status === 403) {
          errorMessage = error.error?.message || 'Access denied. You do not have permission to update this user.';
        } else if (error.status === 401) {
          errorMessage = error.error?.message || 'Authentication failed. Please login again.';
        } else if (error.status === 400) {
          errorMessage = error.error?.message || 'Invalid request. Please check your input.';
        } else if (error.status === 0) {
          errorMessage = 'Network error. Please check your connection and ensure the backend is running on port 5011.';
        }
      }
      
      console.error('[UsersComponent] Final error message:', errorMessage);
      this.errorMessage = errorMessage;
      throw error;
    }
  }

  async toggleStatus(user: any) {
    if (!this.isAdmin && !this.isSuperAdmin) return;
    if (!user?.uid) return;
    // Admin cannot toggle admin users, but superadmin can
    if (user.role === 'admin' && !this.isSuperAdmin) return;
    if (user.role === 'superadmin') return;

    const current = (user.status ?? 'active') as string;
    const next = current === 'active' ? 'disabled' : 'active';

    const actionLabel = next === 'disabled' ? 'disable' : 'activate';
    if (!confirm(`Are you sure you want to ${actionLabel} this user?`)) return;

    try {
      console.log('[UsersComponent] Toggling user status:', {
        uid: user.uid,
        currentStatus: current,
        nextStatus: next
      });

      const response = await this.userService.adminUpdateUserStatus(user.uid, next);
      console.log('[UsersComponent] User status updated successfully:', response);

      // Update local user object immediately
      user.status = next;

      // Show success message
      if (next === 'disabled') {
        alert('This account is disabled.');
      } else {
        alert('Account activated successfully.');
      }

      // Refresh the users list to show updated status
      await this.loadUsers();
    } catch (error: any) {
      console.error('[UsersComponent] Error toggling user status - Full error:', error);
      console.error('[UsersComponent] Error status:', error?.status);
      console.error('[UsersComponent] Error error:', error?.error);
      
      // Extract error message from different possible error formats
      let errorMessage = 'Failed to update user status. Please try again.';
      
      // Handle HttpErrorResponse
      if (error && typeof error === 'object') {
        // Check for Firebase Auth network errors
        if (error.message && error.message.includes('network-request-failed')) {
          errorMessage = 'Network error: Unable to connect to Firebase. Please check your internet connection and try again.';
        }
        // Check for error.error.message (most common format)
        else if (error.error?.message) {
          errorMessage = error.error.message;
        }
        // Check for error.error (string)
        else if (typeof error.error === 'string') {
          errorMessage = error.error;
        }
        // Check for error.message
        else if (error.message) {
          if (error.message.includes('network') || error.message.includes('Network')) {
            errorMessage = 'Network error. Please check your internet connection and ensure the backend is running.';
          } else {
            errorMessage = error.message;
          }
        }
        
        // Check for specific HTTP status codes
        if (error.status === 403) {
          errorMessage = error.error?.message || 'Access denied. You do not have permission to update this user.';
        } else if (error.status === 404) {
          errorMessage = error.error?.message || 'User not found.';
        } else if (error.status === 401) {
          errorMessage = error.error?.message || 'Authentication failed. Please login again.';
        } else if (error.status === 400) {
          errorMessage = error.error?.message || 'Invalid request. Please check your input.';
        } else if (error.status === 0) {
          errorMessage = 'Network error. Please check your connection and ensure the backend is running on port 5011.';
        }
      }
      
      console.error('[UsersComponent] Final error message:', errorMessage);
      alert(errorMessage);
    }
  }

  // DELETE USER FROM BOTH FIRESTORE AND FIREBASE AUTH
  async deleteUser(user: any) {
    if (!this.isAdmin && !this.isSuperAdmin) return;
    // Admin cannot delete admin users, but superadmin can
    if (user.role === 'admin' && !this.isSuperAdmin) return;
    if (user.role === 'superadmin') return;

    if (!confirm(`Are you sure you want to delete user "${user.name || user.email}"? This action cannot be undone.`)) return;

    try {
      // Delete from both Firestore and Firebase Auth via backend
      await this.userService.adminDeleteUser(user.uid);

      // Remove from local arrays immediately
      this.users = this.users.filter(u => u.uid !== user.uid);
      this.applyFilter();

      // Also refresh from server to ensure consistency
      await this.loadUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      const errorMessage = error?.error?.message || 'Failed to delete user. Please try again.';
      alert(errorMessage);
    }
  }
}
