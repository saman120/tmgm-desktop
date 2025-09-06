// src/components/TaskList.js
import React from 'react';
import TaskItem from './TaskItem';
import EmptyState from './EmptyState';
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


  return (
    <div className="task-list-container">
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