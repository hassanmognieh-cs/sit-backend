import { Injectable, inject, EnvironmentInjector } from '@angular/core';
import { Firestore, collection, addDoc, getDocs, doc, updateDoc, query, where, Timestamp, onSnapshot } from '@angular/fire/firestore';
import { Observable, from, firstValueFrom, BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface Task {
  id?: string;
  title: string;
  description?: string | null;
  assignedToEmail: string | 'all';
  createdByName: string;
  createdAt: Date;
  dueDate?: Date | null;
  completed: boolean;
  status?: 'Pending' | 'Taken' | 'Done';
}

// Helper function to convert Firestore Timestamp to Date
function timestampToDate(value: any): Date {
  if (value instanceof Date) {
    return value;
  }
  if (value?.toDate && typeof value.toDate === 'function') {
    return value.toDate();
  }
  if (value?.seconds) {
    return new Date(value.seconds * 1000);
  }
  if (value) {
    return new Date(value);
  }
  return new Date();
}

@Injectable({
  providedIn: 'root'
})
export class TasksService {
  private firestore = inject(Firestore);
  private injector = inject(EnvironmentInjector);
  private http = inject(HttpClient);
  
  // Real-time observables for tasks
  private allTasksSubject = new BehaviorSubject<Task[]>([]);
  public allTasks$ = this.allTasksSubject.asObservable();
  
  private tasksByCreatorSubject = new BehaviorSubject<Map<string, Task[]>>(new Map());
  public tasksByCreator$ = this.tasksByCreatorSubject.asObservable();

  // Normalize status to ensure consistent casing
  private normalizeStatus(status: any): 'Pending' | 'Taken' | 'Done' {
    if (!status) return 'Pending';
    const statusStr = String(status).trim();
    if (statusStr.toLowerCase() === 'done' || statusStr.toLowerCase() === 'completed') {
      return 'Done';
    }
    if (statusStr.toLowerCase() === 'taken' || statusStr.toLowerCase() === 'in-progress') {
      return 'Taken';
    }
    return 'Pending';
  }

  // Get all tasks
  getAllTasks(): Observable<Task[]> {
    return this.injector.runInContext(() => {
      const tasksRef = collection(this.firestore, 'tasks');
      return from(getDocs(tasksRef)).pipe(
        map(snapshot => {
          const tasks = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              title: data['title'] || '',
              description: data['description'] || null,
              assignedToEmail: data['assignedToEmail'] || 'all',
              createdByName: data['createdByName'] || '',
              createdAt: timestampToDate(data['createdAt']),
              dueDate: data['dueDate'] ? timestampToDate(data['dueDate']) : null,
              completed: data['completed'] || false,
              status: this.normalizeStatus(data['status'] || (data['completed'] ? 'Done' : 'Pending'))
            } as Task;
          });
          // Sort by createdAt descending
          return tasks.sort((a, b) => {
            return b.createdAt.getTime() - a.createdAt.getTime();
          });
        })
      );
    });
  }

  // Get tasks assigned to a specific employee
  getTasksByEmployee(email: string): Observable<Task[]> {
    return this.injector.runInContext(() => {
      const tasksRef = collection(this.firestore, 'tasks');
      const q = query(tasksRef, where('assignedToEmail', '==', email));
      return from(getDocs(q)).pipe(
        map(snapshot => {
          console.log(`Found ${snapshot.docs.length} tasks assigned to ${email}`);
          const tasks = snapshot.docs.map(doc => {
            const data = doc.data();
            const task = {
              id: doc.id,
              title: data['title'] || '',
              description: data['description'] || null,
              assignedToEmail: data['assignedToEmail'] || 'all',
              createdByName: data['createdByName'] || '',
              createdAt: timestampToDate(data['createdAt']),
              dueDate: data['dueDate'] ? timestampToDate(data['dueDate']) : null,
              completed: data['completed'] || false,
              status: this.normalizeStatus(data['status'] || (data['completed'] ? 'Done' : 'Pending'))
            } as Task;
            console.log('Task loaded:', task);
            return task;
          });
          // Sort by createdAt descending
          return tasks.sort((a, b) => {
            return b.createdAt.getTime() - a.createdAt.getTime();
          });
        })
      );
    });
  }

  // Get tasks assigned to all employees
  getTasksForAll(): Observable<Task[]> {
    return this.injector.runInContext(() => {
      const tasksRef = collection(this.firestore, 'tasks');
      const q = query(tasksRef, where('assignedToEmail', '==', 'all'));
      return from(getDocs(q)).pipe(
        map(snapshot => {
          console.log(`Found ${snapshot.docs.length} tasks assigned to all employees`);
          const tasks = snapshot.docs.map(doc => {
            const data = doc.data();
            const task = {
              id: doc.id,
              title: data['title'] || '',
              description: data['description'] || null,
              assignedToEmail: data['assignedToEmail'] || 'all',
              createdByName: data['createdByName'] || '',
              createdAt: timestampToDate(data['createdAt']),
              dueDate: data['dueDate'] ? timestampToDate(data['dueDate']) : null,
              completed: data['completed'] || false,
              status: this.normalizeStatus(data['status'] || (data['completed'] ? 'Done' : 'Pending'))
            } as Task;
            console.log('Task loaded:', task);
            return task;
          });
          // Sort by createdAt descending
          return tasks.sort((a, b) => {
            return b.createdAt.getTime() - a.createdAt.getTime();
          });
        })
      );
    });
  }

  // Get tasks created by a manager (one-time query)
  getTasksByCreator(managerEmail: string): Observable<Task[]> {
    return this.injector.runInContext(() => {
      const tasksRef = collection(this.firestore, 'tasks');
      const q = query(tasksRef, where('createdByName', '==', managerEmail));
      return from(getDocs(q)).pipe(
        map(snapshot => {
          console.log(`Found ${snapshot.docs.length} tasks for manager ${managerEmail}`);
          const tasks = snapshot.docs.map(doc => {
            const data = doc.data();
            const task = {
              id: doc.id,
              title: data['title'] || '',
              description: data['description'] || null,
              assignedToEmail: data['assignedToEmail'] || 'all',
              createdByName: data['createdByName'] || '',
              createdAt: timestampToDate(data['createdAt']),
              dueDate: data['dueDate'] ? timestampToDate(data['dueDate']) : null,
              completed: data['completed'] || false,
              status: this.normalizeStatus(data['status'] || (data['completed'] ? 'Done' : 'Pending'))
            } as Task;
            console.log('Task loaded:', task);
            return task;
          });
          // Sort by createdAt descending
          return tasks.sort((a, b) => {
            return b.createdAt.getTime() - a.createdAt.getTime();
          });
        })
      );
    });
  }

  // Real-time listener for tasks created by a manager
  subscribeToTasksByCreator(managerEmail: string, callback: (tasks: Task[]) => void): () => void {
    return this.injector.runInContext(() => {
      const tasksRef = collection(this.firestore, 'tasks');
      const q = query(tasksRef, where('createdByName', '==', managerEmail));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        console.log(`Real-time update: Found ${snapshot.docs.length} tasks for manager ${managerEmail}`);
        const tasks = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data['title'] || '',
            description: data['description'] || null,
            assignedToEmail: data['assignedToEmail'] || 'all',
            createdByName: data['createdByName'] || '',
            createdAt: timestampToDate(data['createdAt']),
            dueDate: data['dueDate'] ? timestampToDate(data['dueDate']) : null,
            completed: data['completed'] || false,
            status: this.normalizeStatus(data['status'] || (data['completed'] ? 'Done' : 'Pending'))
          } as Task;
        });
        
        // Sort by createdAt descending
        const sortedTasks = tasks.sort((a, b) => {
          return b.createdAt.getTime() - a.createdAt.getTime();
        });
        
        callback(sortedTasks);
      }, (error) => {
        console.error('Error in real-time listener for manager tasks:', error);
      });
      
      return unsubscribe;
    });
  }

  // Real-time listener for all tasks (for admin history)
  subscribeToAllTasks(callback: (tasks: Task[]) => void): () => void {
    return this.injector.runInContext(() => {
      const tasksRef = collection(this.firestore, 'tasks');
      
      const unsubscribe = onSnapshot(tasksRef, (snapshot) => {
        console.log(`Real-time update: Found ${snapshot.docs.length} total tasks`);
        const tasks = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data['title'] || '',
            description: data['description'] || null,
            assignedToEmail: data['assignedToEmail'] || 'all',
            createdByName: data['createdByName'] || '',
            createdAt: timestampToDate(data['createdAt']),
            dueDate: data['dueDate'] ? timestampToDate(data['dueDate']) : null,
            completed: data['completed'] || false,
            status: this.normalizeStatus(data['status'] || (data['completed'] ? 'Done' : 'Pending'))
          } as Task;
        });
        
        // Sort by createdAt descending
        const sortedTasks = tasks.sort((a, b) => {
          return b.createdAt.getTime() - a.createdAt.getTime();
        });
        
        callback(sortedTasks);
      }, (error) => {
        console.error('Error in real-time listener for all tasks:', error);
      });
      
      return unsubscribe;
    });
  }

  // Create a new task
  async createTask(task: Omit<Task, 'id'>): Promise<string> {
    return this.injector.runInContext(async () => {
      const tasksRef = collection(this.firestore, 'tasks');
      const taskData: any = {
        title: task.title,
        description: task.description || null,
        assignedToEmail: task.assignedToEmail,
        createdByName: task.createdByName,
        createdAt: Timestamp.now(),
        completed: task.completed || false,
        status: task.status || 'Pending' // Always set status, default to Pending
      };
      
      // Only add dueDate if provided
      if (task.dueDate) {
        const dueDate = task.dueDate instanceof Date ? task.dueDate : new Date(task.dueDate);
        taskData.dueDate = Timestamp.fromDate(dueDate);
      }
      
      console.log('Creating task in Firestore:', taskData);
      const docRef = await addDoc(tasksRef, taskData);
      console.log('Task created with ID:', docRef.id);
      return docRef.id;
    });
  }

  // Update task status via backend API
  async updateTaskStatus(taskId: string, status: 'Pending' | 'Taken' | 'Done', completed: boolean): Promise<void> {
    try {
      if (!taskId || taskId.trim() === '') {
        throw new Error('Task ID is required.');
      }
      
      const url = `${environment.apiBase}/api/tasks/update-status/${encodeURIComponent(taskId)}`;
      console.log('[TasksService] Updating task status via backend:', { 
        taskId, 
        taskIdLength: taskId.length,
        status, 
        completed,
        url 
      });
      
      const response = await firstValueFrom(
        this.http.put<{ message: string; status: string; completed: boolean }>(
          url,
          { status, completed }
        )
      );
      
      console.log('[TasksService] Task status updated successfully:', response);
    } catch (error: any) {
      console.error('[TasksService] Error updating task status:', error);
      
      // Extract error message from HttpErrorResponse
      let errorMessage = 'Failed to update task status. Please try again.';
      
      if (error && typeof error === 'object') {
        if (error.error?.message) {
          errorMessage = error.error.message;
        } else if (typeof error.error === 'string') {
          errorMessage = error.error;
        } else if (error.message) {
          if (error.message.includes('network') || error.message.includes('Network')) {
            errorMessage = 'Network error. Please check your connection and ensure the backend is running.';
          } else {
            errorMessage = error.message;
          }
        }
        
        // Check for specific HTTP status codes
        if (error.status === 403) {
          errorMessage = error.error?.message || 'You do not have permission to update this task. Please contact your manager.';
        } else if (error.status === 404) {
          errorMessage = error.error?.message || 'Task not found.';
        } else if (error.status === 401) {
          errorMessage = error.error?.message || 'Authentication failed. Please login again.';
        } else if (error.status === 400) {
          errorMessage = error.error?.message || 'Invalid request. Please check your input.';
        } else if (error.status === 0) {
          errorMessage = 'Network error. Please check your connection and ensure the backend is running on port 5011.';
        }
      }
      
      throw new Error(errorMessage);
    }
  }

  // Update task (for managers)
  async updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
    return this.injector.runInContext(async () => {
      const taskDoc = doc(this.firestore, `tasks/${taskId}`);
      const updateData: any = {};
      
      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.dueDate !== undefined) {
        updateData.dueDate = updates.dueDate ? Timestamp.fromDate(updates.dueDate instanceof Date ? updates.dueDate : new Date(updates.dueDate)) : null;
      }
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.assignedToEmail !== undefined) updateData.assignedToEmail = updates.assignedToEmail;
      
      await updateDoc(taskDoc, updateData);
    });
  }
}

