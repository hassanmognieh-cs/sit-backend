// src/app/components/history/history.component.ts

import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { InventoryLog } from '../../models/inventory-log';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.css']
})
export class HistoryComponent implements OnInit {

  private http = inject(HttpClient);

  logs: InventoryLog[] = [];
  filteredLogs: InventoryLog[] = [];
  searchText = '';
  errorMessage = '';
  sortOrder: 'newest' | 'oldest' = 'newest';
  selectedDate: string = '';
  selectedType: 'IN' | 'OUT' | 'all' = 'all';

  private readonly _now = new Date();
  private readonly _prevMonth = new Date(this._now.getFullYear(), this._now.getMonth() - 1, 1);
  readonly currentMonth = this._prevMonth.getMonth();
  readonly currentYear  = this._prevMonth.getFullYear();
  readonly currentMonthLabel = this._prevMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

  ngOnInit() {
    this.loadHistory();
  }

  private parseDate(dateValue: any): Date | null {
    if (!dateValue) return null;
    
    // If it's already a Date object
    if (dateValue instanceof Date) {
      return isNaN(dateValue.getTime()) ? null : dateValue;
    }
    
    // If it's a string (ISO format from backend or other string formats)
    if (typeof dateValue === 'string') {
      // Try parsing as ISO string first
      const d = new Date(dateValue);
      if (!isNaN(d.getTime())) {
        return d;
      }
      // Try parsing as date string (dd/MM/yyyy or other formats)
      const parts = dateValue.split(/[-\/]/);
      if (parts.length === 3) {
        // Could be dd/MM/yyyy or yyyy-MM-dd
        const d2 = new Date(dateValue);
        if (!isNaN(d2.getTime())) {
          return d2;
        }
      }
      return null;
    }
    
    // If it's a number (timestamp)
    if (typeof dateValue === 'number') {
      const d = new Date(dateValue);
      return isNaN(d.getTime()) ? null : d;
    }
    
    // If it's an object with timestamp (Firestore Timestamp)
    if (dateValue && typeof dateValue === 'object') {
      // Try toDate if available (Firestore Timestamp method) - this is the primary method
      if (typeof dateValue.toDate === 'function') {
        try {
          const d = dateValue.toDate();
          return isNaN(d.getTime()) ? null : d;
        } catch (e) {
          console.warn('Error converting Firestore timestamp with toDate():', e);
        }
      }
      // Try to get seconds/nanoseconds from Firestore Timestamp
      if (dateValue.seconds !== undefined) {
        const d = new Date(dateValue.seconds * 1000);
        return isNaN(d.getTime()) ? null : d;
      }
      // Try _seconds property (Firestore internal)
      if (dateValue._seconds !== undefined) {
        const d = new Date(dateValue._seconds * 1000);
        return isNaN(d.getTime()) ? null : d;
      }
      // Try toISOString method
      if (typeof dateValue.toISOString === 'function') {
        const d = new Date(dateValue.toISOString());
        return isNaN(d.getTime()) ? null : d;
      }
    }
    
    return null;
  }

  loadHistory() {
    this.http.get<any[]>('http://localhost:5011/api/InventoryLogs')
      .subscribe({
        next: (data) => {
          // Map Firestore documents to InventoryLog model with proper date conversion
          this.logs = data.map((log: any): InventoryLog => {
            // Convert createdAt from Firestore Timestamp to JS Date
            const parsedDate = this.parseDate(log.createdAt);
            
            return {
              id: log.id,
              productId: log.productId,
              productName: log.productName || '',
              type: log.type || 'OUT',
              quantity: log.quantity || 0,
              price: log.price || 0,
              sellingPrice: log.sellingPrice,
              totalCost: log.totalCost ?? null,
              totalRevenue: log.totalRevenue ?? null,
              profit: log.profit ?? null,
              costPerItem: log.quantity > 0 && log.totalCost != null 
                ? log.totalCost / log.quantity 
                : (log.price ?? null),
              reason: log.reason || '',
              note: log.note,
              createdBy: log.createdBy,
              createdAt: parsedDate
            };
          });
          this.applyFilters();
          this.errorMessage = '';
        },
        error: err => {
          console.error(err);
          this.errorMessage = 'Failed to load history. Please try again.';
        }
      });
  }

  filterHistory() {
    this.applyFilters();
  }

  applyFilters() {
    const t = this.searchText.toLowerCase().trim();

    let filtered = this.logs.filter(log => {
      // Current-month filter — only show logs belonging to this calendar month
      const matchesMonth = log.createdAt
        ? log.createdAt.getMonth() === this.currentMonth &&
          log.createdAt.getFullYear() === this.currentYear
        : false;

      // Text search filter
      const matchesSearch = !t ||
        (log.productName || '').toLowerCase().includes(t) ||
        (log.type || '').toLowerCase().includes(t) ||
        (log.reason || '').toLowerCase().includes(t);

      // Date filter (specific day within the month)
      let matchesDate = true;
      if (this.selectedDate) {
        const selectedDateObj = new Date(this.selectedDate);
        if (log.createdAt) {
          const logDate = new Date(log.createdAt);
          matchesDate =
            logDate.getDate() === selectedDateObj.getDate() &&
            logDate.getMonth() === selectedDateObj.getMonth() &&
            logDate.getFullYear() === selectedDateObj.getFullYear();
        } else {
          matchesDate = false;
        }
      }

      // Type filter (IN/OUT)
      const matchesType = this.selectedType === 'all' || log.type === this.selectedType;

      return matchesMonth && matchesSearch && matchesDate && matchesType;
    });

    // Sort by date
    filtered = filtered.sort((a, b) => {
      const dateA = a.createdAt?.getTime() || 0;
      const dateB = b.createdAt?.getTime() || 0;
      return this.sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

    this.filteredLogs = filtered;
  }

  onSortChange() {
    this.applyFilters();
  }

  onDateChange() {
    this.applyFilters();
  }

  onTypeChange() {
    this.applyFilters();
  }

  clearDateFilter() {
    this.selectedDate = '';
    this.applyFilters();
  }

  clearTypeFilter() {
    this.selectedType = 'all';
    this.applyFilters();
  }

  exportToPDF() {
    // Load jsPDF from CDN with better error handling
    const loadJsPDF = () => {
      return new Promise<any>((resolve, reject) => {
        // Check if already loaded
        if (typeof window !== 'undefined') {
          const win = window as any;
          if (win.jspdf && win.jspdf.jsPDF) {
            resolve(win.jspdf.jsPDF);
            return;
          }
          if (win.jsPDF) {
            resolve(win.jsPDF);
            return;
          }
        }
        
        // Check if script already exists
        const existingScript = document.querySelector('script[src*="jspdf"]');
        if (existingScript) {
          // Wait a bit and check again
          setTimeout(() => {
            const win = window as any;
            if (win.jspdf && win.jspdf.jsPDF) {
              resolve(win.jspdf.jsPDF);
            } else if (win.jsPDF) {
              resolve(win.jsPDF);
            } else {
              reject(new Error('jsPDF not available'));
            }
          }, 500);
          return;
        }
        
        // Load from CDN
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        script.async = true;
        
        script.onload = () => {
          setTimeout(() => {
            const win = window as any;
            if (win.jspdf && win.jspdf.jsPDF) {
              resolve(win.jspdf.jsPDF);
            } else if (win.jsPDF) {
              resolve(win.jsPDF);
            } else {
              reject(new Error('jsPDF not available after load'));
            }
          }, 100);
        };
        
        script.onerror = () => {
          // Try alternative CDN
          const altScript = document.createElement('script');
          altScript.src = 'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js';
          altScript.async = true;
          altScript.onload = () => {
            setTimeout(() => {
              const win = window as any;
              if (win.jspdf && win.jspdf.jsPDF) {
                resolve(win.jspdf.jsPDF);
              } else if (win.jsPDF) {
                resolve(win.jsPDF);
              } else {
                reject(new Error('jsPDF not available from alternative CDN'));
              }
            }, 100);
          };
          altScript.onerror = () => reject(new Error('Failed to load jsPDF from all CDNs'));
          document.head.appendChild(altScript);
        };
        
        document.head.appendChild(script);
      });
    };

    loadJsPDF().then((JsPDF: any) => {
      const doc = new JsPDF('landscape', 'mm', 'a4');
      
      // Title
      doc.setFontSize(18);
      doc.text('Inventory History Report', 14, 15);
      
      // Date
      doc.setFontSize(10);
      const today = new Date();
      const dateStr = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;
      doc.text(`Generated: ${dateStr}`, 14, 22);
      
      // Table headers
      doc.setFontSize(9);
      const headers = ['Date', 'Time', 'Product', 'Type', 'Qty', 'Cost/Item', 'Total Cost', 'Total Revenue', 'Profit', 'Reason', 'User'];
      const colWidths = [20, 15, 35, 12, 10, 18, 18, 18, 16, 22, 25];
      let x = 14;
      
      headers.forEach((header, i) => {
        doc.text(header, x, 30);
        x += colWidths[i];
      });
      
      // Table rows
      let y = 37;
      doc.setFontSize(8);
      
      this.filteredLogs.forEach((log) => {
        if (y > 180) {
          doc.addPage();
          y = 15;
          // Redraw headers on new page
          x = 14;
          doc.setFontSize(9);
          headers.forEach((header, i) => {
            doc.text(header, x, y);
            x += colWidths[i];
          });
          y = 22;
          doc.setFontSize(8);
        }
        
        const logDateStr = log.createdAt ? 
          `${log.createdAt.getDate()}/${log.createdAt.getMonth() + 1}/${log.createdAt.getFullYear()}` : 
          '—';
        
        const logTimeStr = log.createdAt ? 
          `${String(log.createdAt.getHours()).padStart(2, '0')}:${String(log.createdAt.getMinutes()).padStart(2, '0')}` : 
          '—';
        
        const row = [
          logDateStr,
          logTimeStr,
          (log.productName || '—').substring(0, 22),
          log.type || '—',
          log.quantity?.toString() || '0',
          log.costPerItem != null ? log.costPerItem.toFixed(2) : '—',
          log.totalCost != null ? log.totalCost.toFixed(2) : '—',
          log.totalRevenue != null ? log.totalRevenue.toFixed(2) : '—',
          log.profit != null ? log.profit.toFixed(2) : '—',
          (log.reason || '—').substring(0, 18),
          (log.createdBy || '—').substring(0, 18)
        ];
        
        x = 14;
        row.forEach((cell, i) => {
          const cellText = doc.splitTextToSize(cell || '—', colWidths[i] - 2);
          doc.text(cellText, x + 1, y);
          x += colWidths[i];
        });
        
        y += 7;
      });
      
      // Save PDF
      const fileName = `inventory-history-${dateStr.replace(/\//g, '-')}.pdf`;
      doc.save(fileName);
    }).catch(err => {
      console.error('Error loading jsPDF:', err);
      // Fallback to print/export as CSV
      this.exportToCSV();
    });
  }

  exportToCSV() {
    // Fallback: Export as CSV
    const headers = ['Date', 'Time', 'Product', 'Type', 'Qty', 'Cost Per Item', 'Total Cost', 'Total Revenue', 'Profit', 'Reason', 'User'];
    const rows = this.filteredLogs.map(log => {
      const dateStr = log.createdAt ? 
        `${log.createdAt.getDate()}/${log.createdAt.getMonth() + 1}/${log.createdAt.getFullYear()}` : 
        '—';
      const timeStr = log.createdAt ? 
        `${String(log.createdAt.getHours()).padStart(2, '0')}:${String(log.createdAt.getMinutes()).padStart(2, '0')}` : 
        '—';
      return [
        dateStr,
        timeStr,
        log.productName || '—',
        log.type || '—',
        log.quantity?.toString() || '0',
        log.costPerItem != null ? log.costPerItem.toFixed(2) : '—',
        log.totalCost != null ? log.totalCost.toFixed(2) : '—',
        log.totalRevenue != null ? log.totalRevenue.toFixed(2) : '—',
        log.profit != null ? log.profit.toFixed(2) : '—',
        log.reason || '—',
        log.createdBy || '—'
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `inventory-history-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}


