import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Notification } from '../components/NotificationBell';

// 1. Define the shape of a task
export interface Task {
  id: string;
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: () => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  checkSuccess?: (result: any) => boolean;
  onSuccess?: (result: any) => void;
  onFailure?: (result: any) => void;
  message?: string; // Optional base message, can be overridden by success/failure messages
  message_success?: string | ((result: any) => string);
  message_failure?: string | ((result: any) => string);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onClick?: (result?: any) => void;
}

// 2. Define the context value's shape
interface TaskWorkerContextType {
  // Allow the user to provide an ID, or we generate a UUID
  addTask: (task: Partial<Task> & Omit<Task, 'id' | 'execute' | 'name'> & { execute: Task['execute'], name: Task['name'] }) => void;
}

// 3. Create the context
const TaskWorkerContext = createContext<TaskWorkerContextType | undefined>(undefined);

// 4. Create the Provider component
interface TaskWorkerProviderProps {
  children: React.ReactNode;
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
}

export const TaskWorkerProvider: React.FC<TaskWorkerProviderProps> = ({ children, setNotifications }) => {
  const [_activeTaskIds, setActiveTaskIds] = useState<Set<string>>(new Set());
  const [_tasks, setTasks] = useState<Task[]>([]);

  const processTask = useCallback(async (task: Task) => {

    setActiveTaskIds(prev => new Set(prev).add(task.id)); //Add task to active set

    // Notify that the task is starting
    setNotifications(prev => [
      {
        id: task.id,
        title: task.name,
        message: task.message || 'Task started and is now running...',
        timestamp: new Date(),
        status: 'unseen',
        state: 'ongoing',
        onClick: task.onClick,
      },
      ...prev,
    ]);

    try {
      const result = await task.execute();
      const isSuccess = task.checkSuccess ? task.checkSuccess(result) : true; // Assume success if no checker

      if (isSuccess) {
        // SUCCESS: Remove the old notification and add a new one for success
        setNotifications(prev => [
          {
            id: `${task.id}-success`,
            title: task.name,
            message: typeof task.message_success === 'function' 
              ? task.message_success(result) 
              : task.message_success || 'Task completed successfully!',
            timestamp: new Date(),
            status: 'unseen',
            // Wrap it here to satisfy the () => void requirement
            onClick: task.onClick ? () => task.onClick?.(result) : undefined, 
            state: 'success',
          },
          ...prev.filter(n => n.id !== task.id)
        ]);
        task.onSuccess?.(result);
      } else {
        // FAILURE: Remove the old notification and add a new one for failure
        setNotifications(prev => [
          {
            id: `${task.id}-failed`,
            title: task.name,
            message: typeof task.message_failure === 'function' 
              ? task.message_failure(result) 
              : task.message_failure || 'Task failed.',
            timestamp: new Date(),
            status: 'unseen',
            state: 'failed',
            onClick: task.onClick ? () => task.onClick?.(result) : undefined,
          },
          ...prev.filter(n => n.id !== task.id)
        ]);
        task.onFailure?.(result);
      }
    } catch (error) {
      // CATASTROPHIC FAILURE (exception in execute)
      console.error('Task execution failed catastrophically:', error);
      setNotifications(prev => prev.map(n => 
        n.id === task.id 
          ? { 
              ...n, 
              state: 'failed', 
              message: 'An unexpected error occurred.', 
              status: 'unseen' 
            } 
          : n
      ));
    } finally {
      setActiveTaskIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(task.id);
        return newSet;
      });
    }
  }, [setNotifications]);

  // 1. Add this ref at the top of your TaskWorkerProvider
  const runningTasksRef = useRef<Set<string>>(new Set());

  const addTask = useCallback((taskInput: Partial<Task> & { execute: Task['execute'], name: Task['name'] }) => {
    const taskId = taskInput.id || uuidv4();

    // 2. CHECK & LOCK SYNCHRONOUSLY
    if (runningTasksRef.current.has(taskId)) {
      console.warn(`Task ${taskId} is already running. Ignoring.`);
      return;
    }

    // Add to the lock
    runningTasksRef.current.add(taskId);

    // 3. Update the state just for UI/Re-renders
    setActiveTaskIds(prev => new Set(prev).add(taskId));

    const newTask: Task = {
      id: taskId,
      ...taskInput,
    } as Task;

    setTasks(prev => [...prev, newTask]);

    // 4. Wrap processTask to ensure the lock is released
    const executeAndRelease = async () => {
      try {
        await processTask(newTask);
      } finally {
        // RELEASE THE LOCK
        runningTasksRef.current.delete(taskId);
        setActiveTaskIds(prev => {
          const next = new Set(prev);
          next.delete(taskId);
          return next;
        });
      }
    };

    executeAndRelease();
  }, [processTask]);

  return (
    <TaskWorkerContext.Provider value={{ addTask }}>
      {children}
    </TaskWorkerContext.Provider>
  );
};

// 5. Create the custom hook for easy consumption
export const useTaskWorker = () => {
  const context = useContext(TaskWorkerContext);
  if (context === undefined) {
    throw new Error('useTaskWorker must be used within a TaskWorkerProvider');
  }
  return context;
};
