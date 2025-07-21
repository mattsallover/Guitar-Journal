import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { aiService } from '../services/ai';
import { useAppContext } from '../context/AppContext';

interface DrillRecommendation {
  type: 'caged' | 'note-finder' | 'technique' | 'song';
  title: string;
  description: string;
  action: string;
  urgency: 'low' | 'medium' | 'high';
}

export const AIRecommendations: React.FC = () => {
  const { state } = useAppContext();
  const navigate = useNavigate();
  const [recommendations, setRecommendations] = useState<DrillRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (state.practiceSessions.length > 0) {
      generateRecommendations();
    } else {
      setLoading(false);
    }
  }, [state.practiceSessions]);

  const generateRecommendations = async () => {
    try {
      const recs = await aiService.generateDrillRecommendations(state.practiceSessions);
      setRecommendations(recs);
    } catch (error) {
      console.error('Failed to generate recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRecommendationClick = (rec: DrillRecommendation) => {
    switch (rec.type) {
      case 'caged':
        navigate('/tools/caged');
        break;
      case 'note-finder':
        navigate('/tools/note-finder');
        break;
      case 'technique':
        navigate('/session/live', { state: { topic: 'Technique Practice' } });
        break;
      case 'song':
        navigate('/repertoire');
        break;
      default:
        navigate('/');
    }
  };

  const dismissRecommendation = (index: number) => {
    const recId = `${recommendations[index].type}-${recommendations[index].title}`;
    setDismissedIds(prev => new Set([...prev, recId]));
  };

  const visibleRecommendations = recommendations.filter((rec, index) => {
    const recId = `${rec.type}-${rec.title}`;
    return !dismissedIds.has(recId);
  });

  if (loading) {
    return (
      <div className="bg-surface p-4 rounded-lg animate-pulse">
        <div className="h-4 bg-border rounded w-1/3 mb-2"></div>
        <div className="h-3 bg-border rounded w-2/3"></div>
      </div>
    );
  }

  if (visibleRecommendations.length === 0) {
    return null;
  }

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high': return 'border-red-500 bg-red-900/20';
      case 'medium': return 'border-yellow-500 bg-yellow-900/20';
      case 'low': return 'border-green-500 bg-green-900/20';
      default: return 'border-border bg-surface';
    }
  };

  const getUrgencyIcon = (urgency: string) => {
    switch (urgency) {
      case 'high': return '🔥';
      case 'medium': return '⚡';
      case 'low': return '💡';
      default: return '🎯';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center space-x-2">
        <div className="text-xl">🤖</div>
        <h3 className="text-lg font-semibold text-text-primary">AI Recommendations</h3>
        <div className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">Smart</div>
      </div>
      
      {visibleRecommendations.map((rec, index) => (
        <div 
          key={index}
          className={`p-4 rounded-lg border-l-4 transition-all hover:scale-[1.02] cursor-pointer ${getUrgencyColor(rec.urgency)}`}
          onClick={() => handleRecommendationClick(rec)}
        >
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-lg">{getUrgencyIcon(rec.urgency)}</span>
                <h4 className="font-semibold text-text-primary">{rec.title}</h4>
              </div>
              <p className="text-sm text-text-secondary mb-2">{rec.description}</p>
              <div className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full inline-block">
                {rec.action}
              </div>
            </div>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                dismissRecommendation(index);
              }}
              className="text-text-secondary hover:text-text-primary text-sm ml-2"
              title="Dismiss recommendation"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};