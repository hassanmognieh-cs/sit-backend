import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class InventoryService {

  private backendUrl = 'http://localhost:5011/api/inventorylogs';

  constructor(private http: HttpClient) {}

  // POST /api/inventorylogs
  recordMovement(data: any): Observable<any> {
    return this.http.post(this.backendUrl, data);
  }
}
