// src/components/TaskList.js
import React from 'react';
import TaskItem from './TaskItem';
import EmptyState from './EmptyState';
import { RefreshCw } from 'lucide-react';
import './TaskList.css';

const TaskList = ({ 
  tasks, 
  onStatusToggle, 
  onDescriptionUpdate, 
  onRefresh ,
  onDelete
}) => {
  if (tasks.length === 0) {
    return <EmptyState onRefresh={onRefresh} />;
  }

  const pendingTasks = tasks.filter(task => task.status === 'pending');
  const inProgressTasks = tasks.filter(task => task.status === 'in-progress');
  const completedTasks = tasks.filter(task => task.status === 'completed');

  return (
    <div className="task-list-container">
      <div className="task-list-header">
        <div className="task-stats">
          <span className="task-stat">
            <span className="stat-number">{inProgressTasks.length}/{pendingTasks.length}</span>
          </span>
        </div>
        <button 
          className="refresh-button"
          onClick={onRefresh}
          title="Refresh tasks"
        >
          <RefreshCw size={16} />
        </button>
      </div>
      
      <div className="task-list">
        {tasks.map((task, index) => (
          <TaskItem
            key={task._id}
            task={task}
            isFirst={index === 0}
            onStatusToggle={onStatusToggle}
            onDescriptionUpdate={onDescriptionUpdate}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
};

export default TaskList;