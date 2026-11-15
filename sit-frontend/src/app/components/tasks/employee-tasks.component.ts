import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { TasksService, Task } from '../../services/tasks.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-employee-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './employee-tasks.component.html',
  styleUrls: ['./employee-tasks.component.css']
})
export class EmployeeTasksComponent implements OnInit {
  private auth = inject(AuthService);
  private tasksService = inject(TasksService);

  tasks: Task[] = [];
  filteredTasks: Task[] = [];
  currentUserEmail: string | null = null;
  
  // Filter
  statusFilter: 'All' | 'Pending' | 'Taken' | 'Done' = 'All';
  
  loading = false;
  error: string = '';

  ngOnInit() {
    this.auth.user$.subscribe(user => {
      if (user) {
        this.currentUserEmail = user.email;
        console.log('Employee component initialized for:', this.currentUserEmail);
        this.loadTasks();
      } else {
        this.currentUserEmail = null;
        this.tasks = [];
        this.filteredTasks = [];
      }
    });
  }

  async loadTasks() {
    if (!this.currentUserEmail) return;
    
    this.loading = true;
    this.error = '';
    try {
      console.log('Loading tasks for employee:', this.currentUserEmail);
      // Get tasks assigned to this employee
      const assignedTasks = await firstValueFrom(
        this.tasksService.getTasksByEmployee(this.currentUserEmail)
      );
      console.log('Assigned tasks:', assignedTasks);
      
      // Get tasks assigned to all employees
      const allTasks = await firstValueFrom(
        this.tasksService.getTasksForAll()
      );
      console.log('All employees tasks:', allTasks);
      
      // Combine and remove duplicates
      const allTasksMap = new Map<string, Task>();
      [...(assignedTasks || []), ...(allTasks || [])].forEach(task => {
        if (task.id) {
          allTasksMap.set(task.id, task);
        }
      });
      
      this.tasks = Array.from(allTasksMap.values()).sort((a, b) => {
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
      
      console.log('Total tasks loaded:', this.tasks.length);
      
      if (this.tasks.length === 0) {
        console.log('No tasks found. Checking if tasks exist in Firestore...');
        // Try to get all tasks as a fallback to verify connection
        try {
          const allTasksCheck = await firstValueFrom(this.tasksService.getAllTasks());
          console.log('All tasks in Firestore:', allTasksCheck.length);
          if (allTasksCheck.length > 0) {
            console.log('Sample task:', allTasksCheck[0]);
          }
        } catch (e) {
          console.error('Error loading all tasks:', e);
        }
      }
      
      this.applyFilter();
    } catch (error: any) {
      console.error('Error loading tasks:', error);
      this.error = error.message || 'Failed to load tasks. Please refresh the page.';
      this.tasks = [];
      this.filteredTasks = [];
    } finally {
      this.loading = false;
    }
  }

  applyFilter() {
    if (this.statusFilter === 'All') {
      this.filteredTasks = this.tasks;
    } else {
      this.filteredTasks = this.tasks.filter(t => {
        const taskStatus = t.status || 'Pending';
        return taskStatus === this.statusFilter;
      });
    }
  }

  onFilterChange() {
    this.applyFilter();
  }

  async markAsTaken(task: Task) {
    if (!task.id) {
      console.error('[EmployeeTasks] markAsTaken: Task ID is missing', task);
      this.error = 'Task ID is missing. Cannot update task.';
      setTimeout(() => { this.error = ''; }, 5000);
      return;
    }
    
    console.log('[EmployeeTasks] markAsTaken: Task object:', { id: task.id, title: task.title, status: task.status });
    
    this.loading = true;
    this.error = '';
    try {
      await this.tasksService.updateTaskStatus(task.id, 'Taken', false);
      await this.loadTasks();
    } catch (error: any) {
      console.error('[EmployeeTasks] Error updating task:', error);
      console.error('[EmployeeTasks] Task ID that failed:', task.id);
      // Check for permission errors
      if (error.code === 'permission-denied' || error.message?.includes('permission')) {
        this.error = 'You do not have permission to update this task. Please contact your manager.';
      } else {
        this.error = error.message || 'Failed to update task status. Please try again.';
      }
      // Clear error after 5 seconds
      setTimeout(() => {
        this.error = '';
      }, 5000);
    } finally {
      this.loading = false;
    }
  }

  async markAsDone(task: Task) {
    if (!task.id) {
      console.error('[EmployeeTasks] markAsDone: Task ID is missing', task);
      this.error = 'Task ID is missing. Cannot update task.';
      setTimeout(() => { this.error = ''; }, 5000);
      return;
    }
    
    console.log('[EmployeeTasks] markAsDone: Task object:', { id: task.id, title: task.title, status: task.status });
    
    this.loading = true;
    this.error = '';
    try {
      await this.tasksService.updateTaskStatus(task.id, 'Done', true);
      await this.loadTasks();
    } catch (error: any) {
      console.error('[EmployeeTasks] Error updating task:', error);
      console.error('[EmployeeTasks] Task ID that failed:', task.id);
      // Check for permission errors
      if (error.code === 'permission-denied' || error.message?.includes('permission')) {
        this.error = 'You do not have permission to update this task. Please contact your manager.';
      } else {
        this.error = error.message || 'Failed to update task status. Please try again.';
      }
      // Clear error after 5 seconds
      setTimeout(() => {
        this.error = '';
      }, 5000);
    } finally {
      this.loading = false;
    }
  }

  getStatusClass(status?: string): string {
    switch (status) {
      case 'Done': return 'status-done';
      case 'Taken': return 'status-taken';
      case 'Pending': return 'status-pending';
      default: return 'status-pending';
    }
  }

  canTakeTask(task: Task): boolean {
    return task.status === 'Pending';
  }

  canMarkDone(task: Task): boolean {
    return task.status === 'Taken' || task.status === 'Pending';
  }
}

