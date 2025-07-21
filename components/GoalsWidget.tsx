import React from 'react';
import { Link } from 'react-router-dom';
import { Goal, GoalStatus } from '../types';
import { Card, CardProgress } from './shared/Card';

interface GoalsWidgetProps {
  goals: Goal[];
  onStartPractice?: (title: string) => void;
}

export const GoalsWidget: React.FC<GoalsWidgetProps> = ({ goals, onStartPractice }) => {
  const activeGoals = goals.filter(g => g.status === GoalStatus.Active);

  if (activeGoals.length === 0) {
    return null;
  }

  return (
    <Card className="mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-text-primary">Active Goals</h3>
        <Link
          to="/goals"
          className="text-primary hover:underline text-sm font-medium"
        >
          View All
        </Link>
      </div>
      
      <div className="space-y-3">
        {activeGoals.slice(0, 3).map(goal => (
          <div key={goal.id} className="flex items-center justify-between p-3 bg-background rounded-md">
            <div className="flex-1 mr-4">
              <div className="flex items-center space-x-2 mb-1">
                <h4 className="font-semibold text-text-primary">{goal.title}</h4>
                <span className="text-xs px-2 py-1 bg-secondary/20 text-secondary rounded-full">
                  {goal.category}
                </span>
              </div>
              <CardProgress value={goal.progress} label={`${goal.progress}% complete`} />
            </div>
            {onStartPractice && (
              <button
                onClick={() => onStartPractice(goal.title)}
                className="text-xs bg-primary hover:bg-primary-hover text-white font-bold py-2 px-3 rounded-md whitespace-nowrap transition-all duration-200 hover:scale-105"
              >
                Practice
              </button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
};