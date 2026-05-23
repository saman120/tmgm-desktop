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
        const statusOrder = { 'in-progress': 0, 'pending': 1, 'hold': 2, 'completed': 3 };
        const statusDiff = statusOrder[a.status] - statusOrder[b.status];
        
        if (statusDiff !== 0) return statusDiff;
        
        return new Date(a.created_at || a.createdAt) - new Date(b.created_at || b.createdAt);
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
  const createTask = useCallback(async (description) => {
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
  }, [loadTasks]);

  // Update existing task
  const updateTask = useCallback(async (taskId, updates) => {
    try {
      setError(null);
      await taskAPI.updateTask(taskId, updates);

      setTasks(prevTasks => prevTasks.map(task => 
        task._id === taskId ? { ...task, ...updates } : task
      ));
    } catch (err) {
      console.error('Failed to update task:', err);
      setError('Failed to update task. Please try again.');
      throw err;
    }
  }, []);

  // Update existing task
  const deleteTask = useCallback(async (taskId) => {
    try {
      setError(null);
      await taskAPI.deleteTask(taskId);
      setTasks(ts => ts.filter(t => t._id !== taskId)); // Reload to ensure proper sorting
    } catch (err) {
      console.error('Failed to delete task:', err);
      setError('Failed to delete task. Please try again.');
      throw err;
    }
  }, []);

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
  const handleDelete = async (taskId) => {
    await deleteTask(taskId);
  };
  
  const handleReorder = async (sourceIndex, destinationIndex) => {
    const updatedTasks = Array.from(tasks);
    const [movedTask] = updatedTasks.splice(sourceIndex, 1);
    updatedTasks.splice(destinationIndex, 0, movedTask);
    
    setTasks(updatedTasks);
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