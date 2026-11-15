import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { TasksService, Task } from '../../services/tasks.service';
import { UserService } from '../../services/users.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-manager-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './manager-tasks.component.html',
  styleUrls: ['./manager-tasks.component.css']
})
export class ManagerTasksComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private tasksService = inject(TasksService);
  private userService = inject(UserService);

  tasks: Task[] = [];
  filteredTasks: Task[] = [];
  employees: any[] = [];
  currentUserEmail: string | null = null;
  private unsubscribeTasks: (() => void) | null = null;
  
  // Filter
  statusFilter: 'All' | 'Pending' | 'Taken' | 'Done' = 'All';
  
  // Modal state
  showTaskModal = false;
  editingTask: Task | null = null;
  
  // Form data
  taskForm = {
    title: '',
    description: '',
    assignedToEmail: 'all',
    dueDate: '',
    status: 'Pending' as 'Pending' | 'Taken' | 'Done'
  };

  loading = false;
  error: string = '';

  ngOnInit() {
    this.auth.user$.subscribe(user => {
      if (user) {
        this.currentUserEmail = user.email;
        console.log('Manager component initialized for:', this.currentUserEmail);
        this.loadTasks();
        this.loadEmployees();
      } else {
        this.currentUserEmail = null;
        this.tasks = [];
        this.filteredTasks = [];
      }
    });
  }

  async loadTasks() {
    if (!this.currentUserEmail) return;
    
    // Unsubscribe from previous listener if exists
    if (this.unsubscribeTasks) {
      this.unsubscribeTasks();
      this.unsubscribeTasks = null;
    }
    
    this.loading = true;
    this.error = '';
    try {
      console.log('Setting up real-time listener for manager:', this.currentUserEmail);
      
      // Set up real-time listener
      this.unsubscribeTasks = this.tasksService.subscribeToTasksByCreator(
        this.currentUserEmail,
        (tasks) => {
          console.log('Real-time update received:', tasks.length, 'tasks');
          this.tasks = tasks || [];
          this.applyFilter();
          this.loading = false;
        }
      );
      
      // Also do an initial load for immediate display
      const tasks = await firstValueFrom(this.tasksService.getTasksByCreator(this.currentUserEmail));
      console.log('Initial load:', tasks.length, 'tasks');
      this.tasks = tasks || [];
      this.applyFilter();
      
      if (this.tasks.length === 0) {
        console.log('No tasks found. Checking if tasks exist in Firestore...');
        // Try to get all tasks as a fallback to verify connection
        try {
          const allTasks = await firstValueFrom(this.tasksService.getAllTasks());
          console.log('All tasks in Firestore:', allTasks.length);
          if (allTasks.length > 0) {
            console.log('Sample task:', allTasks[0]);
          }
        } catch (e) {
          console.error('Error loading all tasks:', e);
        }
      }
    } catch (error: any) {
      console.error('Error loading tasks:', error);
      this.error = error.message || 'Failed to load tasks. Please refresh the page.';
      this.tasks = [];
      this.filteredTasks = [];
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

  async loadEmployees() {
    try {
      const users = await firstValueFrom(this.userService.getAllUsers());
      this.employees = users.filter((u: any) => u.role === 'employee' && u.email);
    } catch (error) {
      console.error('Error loading employees:', error);
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

  openAddTaskModal() {
    this.editingTask = null;
    this.taskForm = {
      title: '',
      description: '',
      assignedToEmail: 'all',
      dueDate: '',
      status: 'Pending'
    };
    this.showTaskModal = true;
    this.error = '';
  }

  openEditTaskModal(task: Task) {
    this.editingTask = task;
    this.taskForm = {
      title: task.title,
      description: task.description || '',
      assignedToEmail: task.assignedToEmail,
      dueDate: task.dueDate ? (task.dueDate instanceof Date ? task.dueDate : new Date(task.dueDate)).toISOString().split('T')[0] : '',
      status: task.status || 'Pending'
    };
    this.showTaskModal = true;
    this.error = '';
  }

  closeTaskModal() {
    this.showTaskModal = false;
    this.editingTask = null;
    this.error = '';
  }

  async saveTask() {
    if (!this.taskForm.title.trim()) {
      this.error = 'Task title is required';
      return;
    }

    if (!this.currentUserEmail) {
      this.error = 'User not authenticated';
      return;
    }

    this.loading = true;
    this.error = '';

    try {
      if (this.editingTask && this.editingTask.id) {
        // Update existing task
        await this.tasksService.updateTask(this.editingTask.id, {
          title: this.taskForm.title,
          description: this.taskForm.description || null,
          assignedToEmail: this.taskForm.assignedToEmail,
          dueDate: this.taskForm.dueDate ? new Date(this.taskForm.dueDate) : null,
          status: this.taskForm.status
        });
      } else {
        // Create new task - ensure status is always set
        const newTask = {
          title: this.taskForm.title.trim(),
          description: this.taskForm.description?.trim() || null,
          assignedToEmail: this.taskForm.assignedToEmail,
          createdByName: this.currentUserEmail,
          createdAt: new Date(),
          dueDate: this.taskForm.dueDate ? new Date(this.taskForm.dueDate) : null,
          status: this.taskForm.status || 'Pending' as 'Pending' | 'Taken' | 'Done',
          completed: this.taskForm.status === 'Done'
        };
        
        console.log('Creating new task:', newTask);
        const taskId = await this.tasksService.createTask(newTask);
        console.log('Task created successfully with ID:', taskId);
      }

      // Reload tasks after save
      await this.loadTasks();
      this.closeTaskModal();
    } catch (error: any) {
      console.error('Error saving task:', error);
      this.error = error.message || 'Failed to save task';
    } finally {
      this.loading = false;
    }
  }

  getEmployeeName(email: string): string {
    if (email === 'all') return 'All Employees';
    const employee = this.employees.find(e => e.email === email);
    return employee?.name || email;
  }

  getStatusClass(status?: string): string {
    switch (status) {
      case 'Done': return 'status-done';
      case 'Taken': return 'status-taken';
      case 'Pending': return 'status-pending';
      default: return 'status-pending';
    }
  }
}

