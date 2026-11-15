import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotifyService, AppNotice } from '../../services/notify.service'; // keep service name as is if unchanged
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [CommonModule],
  template: `
  <div class="notify-wrap">
    <div *ngFor="let n of notes" class="note" 
         [class.warn]="n.kind==='warn'" 
         [class.error]="n.kind==='error'">
      {{ n.text }}
    </div>
  </div>`,
  styles: [`
    .notify-wrap {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .note {
      background: #fff;
      border-left: 4px solid #0d6efd;
      padding: 10px 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,.12);
      border-radius: 10px;
      min-width: 260px;
      font-size: 14px;
    }
    .note.warn { border-color: #ffc107; }
    .note.error { border-color: #dc3545; }
  `]
})
export class NotificationComponent implements OnDestroy {
  notes: AppNotice[] = [];
  sub: Subscription;

  constructor(private bus: NotifyService) {
    this.sub = this.bus.stream.subscribe(n => {
      this.notes.push(n);
      const idx = this.notes.length - 1;
      setTimeout(() => this.notes.splice(idx, 1), 4000);
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }
}


