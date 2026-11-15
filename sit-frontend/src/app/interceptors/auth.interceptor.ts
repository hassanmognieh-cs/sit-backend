import { inject } from '@angular/core';
import {
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest
} from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { from, switchMap, catchError, of } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  // Use of() to wrap the promise in a safe way that handles errors
  return from(auth.getFreshToken().catch(() => '')).pipe(
    switchMap(token => {
      const headers: { [key: string]: string } = {};
      if (token && token.trim()) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const modified = req.clone({
        setHeaders: headers
      });
      return next(modified);
    }),
    catchError((error) => {
      // If token retrieval completely fails, proceed without auth header
      // The backend will return appropriate error (401/403) if auth is required
      console.warn('[AuthInterceptor] Token retrieval failed, proceeding without auth header. Error:', error?.message || error);
      return next(req);
    })
  );
};
