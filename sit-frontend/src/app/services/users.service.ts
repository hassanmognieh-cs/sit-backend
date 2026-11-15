import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Firestore, collection, addDoc, getDocs, deleteDoc, doc } from '@angular/fire/firestore';
import { Observable, from, firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  constructor(
    private firestore: Firestore,
    private http: HttpClient
  ) {}

  // GET ALL USERS
  getAllUsers(): Observable<any[]> {
    const usersRef = collection(this.firestore, 'users');
    return from(getDocs(usersRef)).pipe(
      map(snapshot => {
        return snapshot.docs.map(doc => ({
          uid: doc.id,
          ...doc.data()
        }));
      })
    );
  }

  // ADD USER TO FIRESTORE
  addUser(user: any) {
    const usersRef = collection(this.firestore, 'users');
    return addDoc(usersRef, user);
  }

  // DELETE USER FROM FIRESTORE ONLY
  deleteUserFromFirestore(uid: string) {
    const userDoc = doc(this.firestore, `users/${uid}`);
    return deleteDoc(userDoc);
  }

  // ADMIN/SUPERADMIN: CREATE USER (AUTH + FIRESTORE) via backend (Firebase Admin SDK)
  async adminCreateUser(payload: { email: string; name: string; role: 'employee' | 'manager' | 'admin' }): Promise<{ uid: string; temporaryPassword: string }> {
    return await firstValueFrom(
      this.http.post<{ uid: string; temporaryPassword: string }>(`${environment.apiBase}/api/admin/create-user`, payload)
    );
  }

  // USER: Clear forcePasswordChange via backend (Admin SDK) to avoid weakening Firestore rules
  async clearForcePasswordChangeViaBackend(): Promise<{ ok: boolean }> {
    return await firstValueFrom(
      this.http.post<{ ok: boolean }>(`${environment.apiBase}/api/account/clear-force-password-change`, {})
    );
  }

  // ADMIN: Update user via backend
  async adminUpdateUser(uid: string, payload: { name: string; email: string; role: string }): Promise<{ message: string }> {
    return await firstValueFrom(
      this.http.put<{ message: string }>(`${environment.apiBase}/api/admin/update-user/${uid}`, payload)
    );
  }

  // ADMIN: Update user status via backend
  async adminUpdateUserStatus(uid: string, status: string): Promise<{ message: string }> {
    return await firstValueFrom(
      this.http.put<{ message: string }>(`${environment.apiBase}/api/admin/update-user-status/${uid}`, { status })
    );
  }

  // ADMIN: Delete user from both Firestore and Firebase Auth via backend
  async adminDeleteUser(uid: string): Promise<{ message: string }> {
    return await firstValueFrom(
      this.http.delete<{ message: string }>(`${environment.apiBase}/api/admin/delete-user/${uid}`)
    );
  }
}
