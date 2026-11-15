import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class ProductService {

  private http = inject(HttpClient);
  private auth = inject(AuthService);

  private baseUrl = 'http://localhost:5011/api/products';

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
   * GET all products
   ------------------------------*/
  getProducts(): Observable<any[]> {
    console.log('[ProductService] getProducts() - Calling API:', this.baseUrl);
    return this.getHeaders().pipe(
      switchMap(headers => {
        console.log('[ProductService] getProducts() - Headers obtained, making request');
        return this.http.get<any[]>(this.baseUrl, { headers });
      })
    );
  }

  /** -----------------------------
   * GET product by ID
   ------------------------------*/
  getProductById(id: string): Observable<any> {
    console.log('[ProductService] getProductById() - Calling API for ID:', id);
    return this.getHeaders().pipe(
      switchMap(headers => this.http.get<any>(`${this.baseUrl}/${id}`, { headers }))
    );
  }

  /** -----------------------------
   * ADD product
   ------------------------------*/
  addProduct(product: any): Observable<any> {
    console.log('[ProductService] addProduct() - Calling API with data:', product);
    return this.getHeaders().pipe(
      switchMap(headers => {
        console.log('[ProductService] addProduct() - Headers obtained, making POST request');
        return this.http.post<any>(this.baseUrl, product, { headers });
      })
    );
  }

  /** -----------------------------
   * UPDATE product
   ------------------------------*/
  updateProduct(id: string, product: any): Observable<any> {
    console.log('[ProductService] updateProduct() - Calling API for ID:', id, 'with data:', product);
    return this.getHeaders().pipe(
      switchMap(headers => {
        console.log('[ProductService] updateProduct() - Headers obtained, making PUT request');
        // Backend returns a string, so we accept text response
        return this.http.put(`${this.baseUrl}/${id}`, product, { 
          headers,
          responseType: 'text' as 'json' // Accept text response but parse as JSON
        });
      })
    );
  }

  /** -----------------------------
   * DELETE product
   ------------------------------*/
  deleteProduct(id: string): Observable<any> {
    console.log('[ProductService] deleteProduct() - Calling API for ID:', id);
    return this.getHeaders().pipe(
      switchMap(headers => {
        console.log('[ProductService] deleteProduct() - Headers obtained, making DELETE request');
        // Backend returns a string, so we accept text response
        return this.http.delete(`${this.baseUrl}/${id}`, { 
          headers,
          responseType: 'text' as 'json' // Accept text response but parse as JSON
        });
      })
    );
  }

  /** -----------------------------
   * DECREMENT quantity by 1
   ------------------------------*/
  decrement(id: string): Observable<any> {
    return this.getHeaders().pipe(
      switchMap(headers => this.http.post<any>(`${this.baseUrl}/${id}/decrement`, {}, { headers }))
    );
  }
}
