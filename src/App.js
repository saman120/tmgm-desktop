// src/App.js - Main React Component
import React, { useState, useEffect, useCallback } from 'react';
import TaskList from './components/TaskList';
import AddTaskForm from './components/AddTaskForm';
import Header from './components/Header';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorMessage from './components/ErrorMessage';
import { taskAPI } from './services/api';
import './App.css';

function App() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAddingTask, setIsAddingTask] = useState(false);

  // Load tasks from API
  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const fetchedTasks = await taskAPI.getAllTasks();
      
      // Sort tasks: in-progress first, then pending, then completed, all by created_at desc
      const sortedTasks = fetchedTasks.sort((a, b) => {
        const statusOrder = { 'in-progress': 0, 'pending': 1, 'completed': 2 };
        const statusDiff = statusOrder[a.status] - statusOrder[b.status];
        
        if (statusDiff !== 0) return statusDiff;
        
        return new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt);
      });
      
      setTasks(sortedTasks);
    } catch (err) {
      console.error('Failed to load tasks:', err);
      setError('Failed to load tasks. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Create new task
  const createTask = async (description) => {
    try {
      setError(null);
      const newTask = await taskAPI.createTask({ description, title: 'Example' });
      await loadTasks(); // Reload to ensure proper sorting
      return newTask;
    } catch (err) {
      console.error('Failed to create task:', err);
      setError('Failed to create task. Please try again.');
      throw err;
    }
  };

  // Update existing task
  const updateTask = async (taskId, updates) => {
    try {
      setLoading(true);
      setError(null);
      await taskAPI.updateTask(taskId, updates);
      await loadTasks(); // Reload to ensure proper sorting
    } catch (err) {
      console.error('Failed to update task:', err);
      setError('Failed to update task. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Update existing task
  const deleteTask = async (taskId) => {
    try {
      setLoading(true);
      setError(null);
      await taskAPI.deleteTask(taskId);
      await loadTasks(); // Reload to ensure proper sorting
    } catch (err) {
      console.error('Failed to update task:', err);
      setError('Failed to update task. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Complete current task and start next
  const completeCurrentTask = useCallback(async () => {
    const inProgressTasks = tasks.filter(task => task.status === 'in-progress');
    const pendingTasks = tasks.filter(task => task.status === 'pending');

    if (inProgressTasks.length > 0) {
      const currentTask = inProgressTasks[0];
      
      try {
        // Complete the current task
        await updateTask(currentTask._id, { status: 'completed' });
        
        // Set the next pending task to in-progress
        if (pendingTasks.length > 0) {
          const nextTask = pendingTasks[0];
          await updateTask(nextTask._id, { status: 'in-progress' });
        }
        
        // Focus the window after completing task
        if (window.electronAPI) {
          await window.electronAPI.focusWindow();
        }
      } catch (err) {
        console.error('Failed to complete current task:', err);
        setError('Failed to complete current task.');
      }
    }
  }, [tasks, updateTask]);

  // Setup Electron event listeners
  useEffect(() => {
    console.log('notification:use effect')
    if (!window.electronAPI) return;

    const cleanup = [];

    // Listen for complete current task events
    cleanup.push(window.electronAPI.onCompleteCurrentTask(completeCurrentTask));

    // Listen for notification check events
    cleanup.push(window.electronAPI.onCheckInProgressTask(async () => {
      console.log('notification: in progess task check')
      const inProgressTask = tasks.find(task => task.status === 'in-progress');
      if (inProgressTask) {
        await window.electronAPI.showNotification({
          title: 'Task Reminder',
          body: `In progress: ${inProgressTask.description.substring(0, 50)}${inProgressTask.description.length > 50 ? '...' : ''}`,
          silent: false
        });
      }
    }));

    // Listen for notification clicks
    cleanup.push(window.electronAPI.onNotificationClicked(completeCurrentTask));

    // Listen for add task triggers from dock/tray
    cleanup.push(window.electronAPI.onTriggerAddTask(() => {
      setIsAddingTask(true);
    }));

    // Cleanup function
    return () => {
      cleanup.forEach(cleanupFn => {
        if (typeof cleanupFn === 'function') {
          cleanupFn();
        }
      });
    };
  }, [completeCurrentTask, tasks]);

  // Load tasks on component mount
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Handle task status toggle
  const handleStatusToggle = async (taskId, currentStatus) => {
    const statusCycle = {
      'pending': 'in-progress',
      'in-progress': 'completed',
      'completed': 'pending'
    };

    const newStatus = statusCycle[currentStatus];
    await updateTask(taskId, { status: newStatus });
  };

  // Handle task description update
  const handleDescriptionUpdate = async (taskId, newDescription) => {
    await updateTask(taskId, { description: newDescription });
  };

  // Handle task description update
  const handleDelete = async (taskId) => {
    await deleteTask(taskId);
  };

  // Clear error message
  const clearError = () => setError(null);

  return (
    <div className="app">
      <Header />
      
      <main className="app-main">
        {error && (
          <ErrorMessage 
            message={error} 
            onDismiss={clearError}
          />
        )}
        
        {loading ? (
          <LoadingSpinner />
        ) : (
          <TaskList
            tasks={tasks}
            onStatusToggle={handleStatusToggle}
            onDescriptionUpdate={handleDescriptionUpdate}
            onDelete={handleDelete}
          />
        )}
      </main>
      
      <footer className="app-footer">
        <AddTaskForm
          isOpen={isAddingTask}
          onRefresh={loadTasks}
          onOpen={() => setIsAddingTask(true)}
          onClose={() => setIsAddingTask(false)}
          onSubmit={createTask}
        />
      </footer>
    </div>
  );
}

export default App;