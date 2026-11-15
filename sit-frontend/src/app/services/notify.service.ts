import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface AppNotice { text: string; kind?: 'info'|'warn'|'error' }
@Injectable({ providedIn: 'root' })
export class NotifyService {
  stream = new Subject<AppNotice>();
  push(text: string, kind: AppNotice['kind']='info') { this.stream.next({ text, kind }); }
}
