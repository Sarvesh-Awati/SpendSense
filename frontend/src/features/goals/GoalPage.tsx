import React from 'react';
import GoalList from './GoalList';

export const GoalPage: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <GoalList />
    </div>
  );
};

export default GoalPage;
