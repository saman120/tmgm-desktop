// src/services/api.js - API service for task management
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3840';

class APIError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'APIError';
    this.status = status;
  }
}

const apiRequest = async (endpoint, options = {}) => {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new APIError(
        `API request failed: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`,
        response.status
      );
    }

    // Handle empty responses
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    
    return null;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    
    // Handle network errors, CORS issues, etc.
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new APIError('Network error - Please check your connection and ensure the API server is running', 0);
    }
    
    throw new APIError(`Request failed: ${error.message}`, 0);
  }
};

export const taskAPI = {
  // Get all tasks
  async getAllTasks() {
    const tasks = await apiRequest('/api/tasks');
    return Array.isArray(tasks) ? tasks : [];
  },

  // Get task by ID
  async getTaskById(id) {
    return await apiRequest(`/api/tasks/${id}`);
  },

  // Create new task
  async createTask(taskData) {
    return await apiRequest('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData)
    });
  },

  // Update existing task
  async updateTask(id, updates) {
    return await apiRequest(`/api/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  },

  // Delete task
  async deleteTask(id) {
    return await apiRequest(`/api/tasks/${id}`, {
      method: 'DELETE'
    });
  }
};

// Export API utilities
export { APIError, apiRequest };
export default taskAPI;