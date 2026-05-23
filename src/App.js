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

  const sortTasks = (tasks) => {
      // Sort tasks: in-progress first, then pending, then completed, all by created_at desc
      const sortedTasks = tasks.sort((a, b) => {
        const statusOrder = { 'in-progress': 0, 'pending': 1, 'hold': 2, 'completed': 3 };
        const statusDiff = statusOrder[a.status] - statusOrder[b.status];
        
        if (statusDiff !== 0) return statusDiff;

        if(a.status === 'completed') 
          return new Date(b.updatedAt || b.createdAt) -  new Date(a.updatedAt || a.createdAt);

        const orderA = a.order !== undefined ? a.order : 0;
        const orderB = b.order !== undefined ? b.order : 0;
  
        if (orderA !== orderB) {
          return orderA - orderB; 
        }
        
        return new Date(a.updatedAt || a.createdAt) - new Date(b.updatedAt || b.createdAt);
      });

      setTasks(sortedTasks);
  }

  // Load tasks from API
  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const fetchedTasks = await taskAPI.getAllTasks();
      sortTasks(fetchedTasks);
    } catch (err) {
      console.error('Failed to load tasks:', err);
      setError('Failed to load tasks. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Create new task
  const createTask = useCallback(async (description) => {
    try {
      setError(null);
      const newTask = await taskAPI.createTask({ description, title: 'Example' });
      
      sortTasks([...tasks, newTask]);
    } catch (err) {
      console.error('Failed to create task:', err);
      setError('Failed to create task. Please try again.');
      throw err;
    }
  }, [tasks]);

  // Update existing task
  const updateTask = useCallback(async (taskId, updates) => {
    try {
      setError(null);
      const updatedTask = await taskAPI.updateTask(taskId, updates);

      sortTasks(tasks.map(task => 
        task._id === taskId ? updatedTask : task
      ));
    } catch (err) {
      console.error('Failed to update task:', err);
      setError('Failed to update task. Please try again.');
      throw err;
    }
  }, [tasks]);

  // Update existing task
  const deleteTask = useCallback(async (taskId) => {
    try {
      setError(null);
      await taskAPI.deleteTask(taskId);
      sortTasks(tasks.filter(t => t._id !== taskId)); // Reload to ensure proper sorting
    } catch (err) {
      console.error('Failed to delete task:', err);
      setError('Failed to delete task. Please try again.');
      throw err;
    }
  }, [tasks]);

  // Load tasks on component mount
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Handle task status toggle
  const handleStatusToggle = async (taskId, currentStatus, status) => {
    const statusCycle = {
      'hold': 'in-progress',
      'in-progress': 'completed',
      'pending': 'in-progress'
    };

    const newStatus = status || statusCycle[currentStatus];
    await updateTask(taskId, { status: newStatus });
  };

  // Handle task description update
  const handleDescriptionUpdate = async (taskId, newDescription) => {
    await updateTask(taskId, { description: newDescription });
  };

  // Handle task description update
  const handleTaskUpdate = async (taskId, update) => {
    await updateTask(taskId, update);
  };

  // Handle task description update
  const handleDelete = async (taskId) => {
    await deleteTask(taskId);
  };

  const handleReorder = async (taskId, newOrder) => {
    // 1. Optimistically update the UI instantly
    setTasks(tasks => 
      tasks.map(task => 
        task._id === taskId 
          ? { ...task, order: newOrder } 
          : task
      )
    );
    await updateTask(taskId, { order: newOrder });
  }

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
            onTaskUpdate={handleTaskUpdate}
            onDelete={handleDelete}
            onReorder={handleReorder}
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