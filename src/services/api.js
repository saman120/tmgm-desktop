// src/services/api.js - API service for task management
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3840';

const STORAGE_KEYS = {
  tasks: 'tmgm_tasks',
  daySummaries: 'tmgm_day_summaries'
};

const readStorage = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const writeStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage write errors
  }
};

const getStoredTasks = () => readStorage(STORAGE_KEYS.tasks, []);
const setStoredTasks = (tasks) => writeStorage(STORAGE_KEYS.tasks, Array.isArray(tasks) ? tasks : []);

const getStoredDaySummaries = () => readStorage(STORAGE_KEYS.daySummaries, {});
const setStoredDaySummaries = (daySummaries) => writeStorage(STORAGE_KEYS.daySummaries, daySummaries || {});

const runInBackground = (promise) => {
  promise.catch(() => {
    // ignore background sync errors
  });
};

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
    try {
      const tasks = await apiRequest('/api/tasks');
      const normalized = Array.isArray(tasks) ? tasks : [];
      setStoredTasks(normalized);
      return normalized;
    } catch {
      return getStoredTasks();
    }
  },

  // Get task by ID
  async getTaskById(id) {
    const tasks = getStoredTasks();
    const localTask = tasks.find((task) => String(task?.id) === String(id)) || null;

    runInBackground(
      apiRequest(`/api/tasks/${id}`).then((serverTask) => {
        if (!serverTask) return;
        const nextTasks = getStoredTasks();
        const index = nextTasks.findIndex((task) => String(task?.id) === String(id));
        if (index >= 0) {
          nextTasks[index] = serverTask;
        } else {
          nextTasks.push(serverTask);
        }
        setStoredTasks(nextTasks);
      })
    );

    return localTask;
  },

  // Create new task
  async createTask(taskData) {
    const localTasks = getStoredTasks();
    const tempId = taskData?.id ?? `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const localTask = { ...taskData, id: tempId };
    setStoredTasks([...localTasks, localTask]);

    runInBackground(
      apiRequest('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(taskData)
      }).then((createdTask) => {
        if (!createdTask) return;
        const current = getStoredTasks();
        const next = current.map((task) => (String(task?.id) === String(tempId) ? createdTask : task));
        setStoredTasks(next);
      })
    );

    return localTask;
  },

  // Update existing task
  async updateTask(id, updates) {
    const localTasks = getStoredTasks();
    const index = localTasks.findIndex((task) => String(task?.id) === String(id));
    const updatedLocalTask = index >= 0
      ? { ...localTasks[index], ...updates }
      : { id, ...updates };

    if (index >= 0) {
      localTasks[index] = updatedLocalTask;
    } else {
      localTasks.push(updatedLocalTask);
    }
    setStoredTasks(localTasks);

    runInBackground(
      apiRequest(`/api/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      }).then((serverTask) => {
        if (!serverTask) return;
        const current = getStoredTasks();
        const serverIndex = current.findIndex((task) => String(task?.id) === String(id));
        if (serverIndex >= 0) {
          current[serverIndex] = serverTask;
        } else {
          current.push(serverTask);
        }
        setStoredTasks(current);
      })
    );

    return updatedLocalTask;
  },

  // Delete task
  async deleteTask(id) {
    const localTasks = getStoredTasks();
    setStoredTasks(localTasks.filter((task) => String(task?.id) !== String(id)));

    runInBackground(
      apiRequest(`/api/tasks/${id}`, {
        method: 'DELETE'
      })
    );

    return { success: true };
  },

  // Get all day summaries (local-first data is already the full map, no network round-trip needed)
  async getAllDaySummaries() {
    return getStoredDaySummaries();
  },

  // Get day summary by date
  async getDaySummaryByDate(date) {
    const allSummaries = getStoredDaySummaries();
    const localSummary = allSummaries?.[date] ?? null;

    runInBackground(
      apiRequest(`/api/day-summaries/${date}`).then((serverSummary) => {
        const current = getStoredDaySummaries();
        current[date] = serverSummary;
        setStoredDaySummaries(current);
      })
    );

    return localSummary;
  },

  // Update day summary by date
  async updateDaySummaryByDate(date, daySummaryData) {
    const allSummaries = getStoredDaySummaries();
    const updatedLocalSummary = {
      ...(allSummaries[date] || {}),
      ...daySummaryData
    };
    allSummaries[date] = updatedLocalSummary;
    setStoredDaySummaries(allSummaries);

    runInBackground(
      apiRequest(`/api/day-summaries/${date}`, {
        method: 'PUT',
        body: JSON.stringify(daySummaryData)
      }).then((serverSummary) => {
        const current = getStoredDaySummaries();
        current[date] = serverSummary;
        setStoredDaySummaries(current);
      })
    );

    return updatedLocalSummary;
  },
};

// Export API utilities
export { APIError, apiRequest };
export default taskAPI;