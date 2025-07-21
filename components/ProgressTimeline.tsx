import React from 'react';
import { PracticeSession, Mood } from '../types';
import { Card } from './shared/Card';

const moodIcons: Record<Mood, string> = {
  [Mood.Excellent]: '😊',
  [Mood.Good]: '🙂',
  [Mood.Okay]: '😐',
  [Mood.Challenging]: '😕',
  [Mood.Frustrated]: '😠',
};

interface ProgressTimelineProps {
  sessions: PracticeSession[];
  title?: string;
  onPracticeAgain?: (topic: string) => void;
}

export const ProgressTimeline: React.FC<ProgressTimelineProps> = ({
  sessions,
  title,
  onPracticeAgain
}) => {
  if (sessions.length === 0) {
    return (
      <Card>
        <div className="text-center p-8 text-text-secondary">
          <div className="text-4xl mb-4">🤔</div>
          <h3 className="text-xl font-bold mb-2">No Sessions Found</h3>
          <p>No practice sessions found{title ? ` for "${title}"` : ''}. Start practicing to see your progress!</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="relative border-l-2 border-border ml-4 pl-8 space-y-6">
      {sessions.map(session => (
        <div key={session.id} className="relative">
          <div className="absolute -left-10 top-1 w-4 h-4 bg-primary rounded-full border-4 border-background"></div>
          <Card>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <h4 className="text-lg font-semibold text-text-primary">
                    {new Date(session.date).toLocaleDateString('en-CA')}
                  </h4>
                  <span className="text-text-secondary">•</span>
                  <span className="text-text-secondary">{session.duration} min</span>
                  <span className="text-xl">{moodIcons[session.mood]}</span>
                  <span className="text-text-secondary">{session.mood}</span>
                </div>
                {session.notes && (
                  <p className="text-text-primary whitespace-pre-wrap mb-3">{session.notes}</p>
                )}
                {session.recordings.length > 0 && (
                  <div className="mt-3 border-t border-border pt-3">
                    <h5 className="font-semibold text-text-secondary text-sm mb-2">Recordings:</h5>
                    <div className="space-y-3">
                      {session.recordings.map(rec => (
                        <div key={rec.id}>
                          <p className="text-sm text-text-primary mb-1">{rec.name}</p>
                          {rec.type === 'audio' ? (
                            <audio controls src={rec.url} className="h-10 w-full"></audio>
                          ) : (
                            <video controls src={rec.url} className="max-w-xs rounded-md border border-border"></video>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {onPracticeAgain && title && (
                <button
                  onClick={() => onPracticeAgain(title)}
                  className="text-sm bg-primary/20 hover:bg-primary/40 text-primary font-bold py-2 px-3 rounded-md whitespace-nowrap transition-all duration-200 hover:scale-105 opacity-0 group-hover:opacity-100"
                >
                  Practice Again
                </button>
              )}
            </div>
          </Card>
        </div>
      ))}
    </div>
  );
};