import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';

interface ChatResponse {
  answer: string;//recieve reponse from api or server ka anser
}

@Injectable({
  providedIn: 'root'
})
export class ChatbotService {

  private http = inject(HttpClient);//connect http
  private auth = inject(AuthService);// recive token of user abel send to backend
  private baseUrl = 'http://localhost:5011/api/chatbot'; //title api
  // change port if needed

  /** Get fresh JWT token and return headers as Observable */
  private getHeaders(): Observable<HttpHeaders> {
    return from(this.auth.getFreshToken()).pipe(//get refrech token
      switchMap(token => {
        const headers = new HttpHeaders({
          Authorization: `Bearer ${token}`,//precis hawite users
          'Content-Type': 'application/json'//send info type json 
        });
        return of(headers);
      })
    );
  }

  askQuestion(question: string): Observable<ChatResponse> {
    return this.getHeaders().pipe(//getheaders heye la token 
      switchMap(headers => {//for send question to server
        return this.http.post<ChatResponse>(`${this.baseUrl}/ask`, { question }, { headers });
      })
    );
  }
}
