import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TasksService, Task } from '../../services/tasks.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-task-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './task-history.component.html',
  styleUrls: ['./task-history.component.css']
})
export class TaskHistoryComponent implements OnInit, OnDestroy {
  private tasksService = inject(TasksService);

  tasks: Task[] = [];
  groupedTasks: { [key: string]: Task[] } = {};
  sortedDates: string[] = [];
  
  loading = false;
  error: string = '';
  private unsubscribeTasks: (() => void) | null = null;

  expandedDates: Set<string> = new Set();
  showOlderTasks = false;

  ngOnInit() {
    this.loadTasks();
  }

  async loadTasks() {
    // Unsubscribe from previous listener if exists
    if (this.unsubscribeTasks) {
      this.unsubscribeTasks();
      this.unsubscribeTasks = null;
    }
    
    this.loading = true;
    try {
      console.log('Setting up real-time listener for all tasks');
      
      // Set up real-time listener
      this.unsubscribeTasks = this.tasksService.subscribeToAllTasks((tasks) => {
        console.log('Real-time update received:', tasks.length, 'tasks');
        this.tasks = tasks;
        this.groupTasksByDate();
        this.loading = false;
      });
      
      // Also do an initial load for immediate display
      const tasks = await firstValueFrom(this.tasksService.getAllTasks());
      console.log('Initial load:', tasks.length, 'tasks');
      this.tasks = tasks;
      this.groupTasksByDate();
    } catch (error) {
      console.error('Error loading task history:', error);
      this.error = 'Failed to load task history';
    } finally {
      this.loading = false;
    }
  }

  ngOnDestroy() {
    // Clean up real-time listener
    if (this.unsubscribeTasks) {
      this.unsubscribeTasks();
      this.unsubscribeTasks = null;
    }
  }

  groupTasksByDate() {
    this.groupedTasks = {};
    
    this.tasks.forEach(task => {
      const date = task.createdAt instanceof Date ? task.createdAt : new Date(task.createdAt);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return; // Skip invalid dates
      }
      
      const dateKey = this.formatDateKey(date);
      
      if (!this.groupedTasks[dateKey]) {
        this.groupedTasks[dateKey] = [];
      }
      this.groupedTasks[dateKey].push(task);
    });

    // Sort dates in descending order
    this.sortedDates = Object.keys(this.groupedTasks).sort((a, b) => {
      const dateA = new Date(a);
      const dateB = new Date(b);
      if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
        return 0;
      }
      return dateB.getTime() - dateA.getTime();
    });

    if (this.expandedDates.size === 0 && this.sortedDates.length > 0) {
      this.expandedDates.add(this.sortedDates[0]);
    }
  }

  formatDateKey(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  formatDisplayDate(dateString: string): string {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    const day = date.getDate();
    const month = this.getMonthName(date.getMonth());
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  }

  getMonthName(month: number): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[month];
  }

  getEmployeeName(email: string): string {
    if (email === 'all') return 'All Employees';
    return email;
  }

  getStatusDisplay(status?: string): string {
    return status || 'Pending';
  }

  toggleDate(date: string) {
    if (this.expandedDates.has(date)) {
      this.expandedDates.delete(date);
    } else {
      this.expandedDates.add(date);
    }
  }

  isExpanded(date: string): boolean {
    return this.expandedDates.has(date);
  }

  get recentDates(): string[] {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return this.sortedDates.filter(d => {
      const date = new Date(d);
      return !isNaN(date.getTime()) && date >= thirtyDaysAgo;
    });
  }

  get olderTasksCount(): number {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return this.tasks.filter(t => {
      const d = t.createdAt instanceof Date ? t.createdAt : new Date(t.createdAt);
      return !isNaN(d.getTime()) && d < thirtyDaysAgo;
    }).length;
  }

  get olderDates(): string[] {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return this.sortedDates.filter(d => {
      const date = new Date(d);
      return !isNaN(date.getTime()) && date < thirtyDaysAgo;
    });
  }

  getStatusClass(status?: string): string {
    switch (status) {
      case 'Pending': return 'pending';
      case 'Taken': return 'progress';
      case 'Done': return 'done';
      default: return 'pending';
    }
  }
}

