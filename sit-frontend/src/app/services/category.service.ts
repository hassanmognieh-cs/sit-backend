import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class CategoryService {

  private http = inject(HttpClient);
  private auth = inject(AuthService);

  private baseUrl = 'http://localhost:5011/api/categories';

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
   * GET all categories
   ------------------------------*/
  getCategories(): Observable<any[]> {
    console.log('[CategoryService] getCategories() - Calling API:', this.baseUrl);
    return this.getHeaders().pipe(
      switchMap(headers => {
        console.log('[CategoryService] getCategories() - Headers obtained, making request');
        return this.http.get<any[]>(this.baseUrl, { headers });
      })
    );
  }

  /** -----------------------------
   * GET category by ID
   ------------------------------*/
  getCategoryById(id: string): Observable<any> {
    console.log('[CategoryService] getCategoryById() - Calling API for ID:', id);
    return this.getHeaders().pipe(
      switchMap(headers => this.http.get<any>(`${this.baseUrl}/${id}`, { headers }))
    );
  }

  /** -----------------------------
   * ADD category
   ------------------------------*/
  addCategory(category: any): Observable<any> {
    console.log('[CategoryService] addCategory() - Calling API with data:', category);
    return this.getHeaders().pipe(
      switchMap(headers => {
        console.log('[CategoryService] addCategory() - Headers obtained, making POST request');
        return this.http.post<any>(this.baseUrl, category, { headers });
      })
    );
  }

  /** -----------------------------
   * UPDATE category
   ------------------------------*/
  updateCategory(id: string, category: any): Observable<any> {
    console.log('[CategoryService] updateCategory() - Calling API for ID:', id, 'with data:', category);
    return this.getHeaders().pipe(
      switchMap(headers => {
        console.log('[CategoryService] updateCategory() - Headers obtained, making PUT request');
        // Backend returns a string, so we accept text response
        return this.http.put(`${this.baseUrl}/${id}`, category, { 
          headers,
          responseType: 'text' as 'json' // Accept text response but parse as JSON
        });
      })
    );
  }

  /** -----------------------------
   * DELETE category
   ------------------------------*/
  deleteCategory(id: string): Observable<any> {
    console.log('[CategoryService] deleteCategory() - Calling API for ID:', id);
    return this.getHeaders().pipe(
      switchMap(headers => {
        console.log('[CategoryService] deleteCategory() - Headers obtained, making DELETE request');
        // Backend returns a string, so we accept text response
        return this.http.delete(`${this.baseUrl}/${id}`, { 
          headers,
          responseType: 'text' as 'json' // Accept text response but parse as JSON
        });
      })
    );
  }
}

