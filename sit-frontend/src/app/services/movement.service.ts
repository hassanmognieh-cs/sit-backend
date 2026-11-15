import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, updateDoc, doc, serverTimestamp } from '@angular/fire/firestore';
import { Observable, from } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MovementService {
  private firestore = inject(Firestore);

  // Add a new movement with automatic date timestamp
  addMovement(movement: any): Observable<any> {
    const movementsRef = collection(this.firestore, 'movements');
    return from(addDoc(movementsRef, {
      ...movement,
      date: serverTimestamp()
    }));
  }

  // Update a movement without overwriting the date
  updateMovement(movementId: string, data: any): Observable<void> {
    const movementRef = doc(this.firestore, 'movements', movementId);
    // Remove date from data to prevent overwriting
    delete data.date;
    return from(updateDoc(movementRef, data));
  }
}

