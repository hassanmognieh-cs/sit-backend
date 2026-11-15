import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class SupplierService {

  private http = inject(HttpClient);
  private auth = inject(AuthService);

  private baseUrl = 'http://localhost:5011/api/suppliers';

  /** Get fresh JWT token and return headers as Observable */
  private getHeaders(): Observable<HttpHeaders> {
    return from(this.auth.getFreshToken()).pipe(
      switchMap(token => {
        const headers = new HttpHeaders({
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        });
        return of(headers);
      })
    );
  }

  /** -----------------------------
   * GET all suppliers
   ------------------------------*/
  getSuppliers(): Observable<any[]> {
    console.log('[SupplierService] getSuppliers() - Calling API:', this.baseUrl);
    return this.getHeaders().pipe(
      switchMap(headers => {
        console.log('[SupplierService] getSuppliers() - Headers obtained, making request');
        return this.http.get<any[]>(this.baseUrl, { headers });
      })
    );
  }

  /** -----------------------------
   * GET supplier by ID
   ------------------------------*/
  getSupplierById(id: string): Observable<any> {
    console.log('[SupplierService] getSupplierById() - Calling API for ID:', id);
    return this.getHeaders().pipe(
      switchMap(headers => this.http.get<any>(`${this.baseUrl}/${id}`, { headers }))
    );
  }

  /** -----------------------------
   * ADD supplier
   ------------------------------*/
  addSupplier(supplier: any): Observable<any> {
    console.log('[SupplierService] addSupplier() - Calling API with data:', supplier);
    return this.getHeaders().pipe(
      switchMap(headers => {
        console.log('[SupplierService] addSupplier() - Headers obtained, making POST request');
        return this.http.post<any>(this.baseUrl, supplier, { headers });
      })
    );
  }

  /** -----------------------------
   * UPDATE supplier
   ------------------------------*/
  updateSupplier(id: string, supplier: any): Observable<any> {
    console.log('[SupplierService] updateSupplier() - Calling API for ID:', id, 'with data:', supplier);
    return this.getHeaders().pipe(
      switchMap(headers => {
        console.log('[SupplierService] updateSupplier() - Headers obtained, making PUT request');
        // Backend returns a string, so we accept text response
        return this.http.put(`${this.baseUrl}/${id}`, supplier, { 
          headers,
          responseType: 'text' as 'json' // Accept text response but parse as JSON
        });
      })
    );
  }

  /** -----------------------------
   * DELETE supplier
   ------------------------------*/
  deleteSupplier(id: string): Observable<any> {
    console.log('[SupplierService] deleteSupplier() - Calling API for ID:', id);
    return this.getHeaders().pipe(
      switchMap(headers => {
        console.log('[SupplierService] deleteSupplier() - Headers obtained, making DELETE request');
        // Backend returns a string, so we accept text response
        return this.http.delete(`${this.baseUrl}/${id}`, { 
          headers,
          responseType: 'text' as 'json' // Accept text response but parse as JSON
        });
      })
    );
  }
}
