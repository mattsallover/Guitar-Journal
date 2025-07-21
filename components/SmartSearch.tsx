import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { aiService } from '../services/ai';
import { useAppContext } from '../context/AppContext';

interface SearchResult {
  id: string;
  type: 'session' | 'goal' | 'repertoire';
  title: string;
  content: string;
  relevanceScore: number;
  date: string;
  searchableText?: string;
}

export const SmartSearch: React.FC = () => {
  const { state } = useAppContext();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Prepare searchable content
  const searchableContent = useMemo(() => {
    const content: SearchResult[] = [];
    
    // Practice sessions
    state.practiceSessions.forEach(session => {
      content.push({
        id: session.id,
        type: 'session',
        title: `Practice Session - ${new Date(session.date).toLocaleDateString()}`,
        content: `${session.mood} mood, ${session.duration} minutes. Techniques: ${(session.techniques || []).join(', ')}. Songs: ${(session.songs || []).join(', ')}. Notes: ${session.notes}`,
        relevanceScore: 0,
        date: session.date,
        searchableText: `${session.mood} ${session.techniques?.join(' ')} ${session.songs?.join(' ')} ${session.notes} ${session.tags?.join(' ')}`
      });
    });
    
    // Goals
    state.goals.forEach(goal => {
      content.push({
        id: goal.id,
        type: 'goal',
        title: goal.title,
        content: `${goal.category} goal: ${goal.description}. Status: ${goal.status}, ${goal.progress}% complete.`,
        relevanceScore: 0,
        date: goal.targetDate,
        searchableText: `${goal.title} ${goal.description} ${goal.category} ${goal.status}`
      });
    });
    
    // Repertoire
    state.repertoire.forEach(item => {
      content.push({
        id: item.id,
        type: 'repertoire',
        title: `${item.title} by ${item.artist}`,
        content: `${item.difficulty} difficulty, ${item.mastery}% mastery. Notes: ${item.notes}`,
        relevanceScore: 0,
        date: item.dateAdded,
        searchableText: `${item.title} ${item.artist} ${item.difficulty} ${item.notes}`
      });
    });
    
    return content;
  }, [state.practiceSessions, state.goals, state.repertoire]);

  const handleSearch = async () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    
    setLoading(true);
    try {
      const searchResults = await aiService.semanticSearch(query, searchableContent);
      setResults(searchResults);
      setIsExpanded(true);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    switch (result.type) {
      case 'session':
        navigate('/log');
        break;
      case 'goal':
        navigate('/goals');
        break;
      case 'repertoire':
        navigate(`/repertoire/${result.id}`);
        break;
    }
    setIsExpanded(false);
    setQuery('');
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'session': return '📓';
      case 'goal': return '🎯';
      case 'repertoire': return '🎵';
      default: return '📄';
    }
  };

  const getResultTypeLabel = (type: string) => {
    switch (type) {
      case 'session': return 'Practice Session';
      case 'goal': return 'Goal';
      case 'repertoire': return 'Song';
      default: return 'Item';
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (query.trim().length > 2) {
        handleSearch();
      } else {
        setResults([]);
      }
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [query]);

  return (
    <div className="relative">
      <div className="bg-surface p-4 rounded-lg">
        <div className="flex items-center space-x-2 mb-3">
          <div className="text-primary text-xl">🔍</div>
          <h3 className="text-lg font-semibold text-text-primary">Smart Search</h3>
          <div className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">AI</div>
        </div>
        
        <div className="flex space-x-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsExpanded(true)}
            placeholder="Search your practice journal... (e.g., 'sessions where I practiced fingerstyle')"
            className="flex-1 bg-background p-3 rounded-md border border-border text-text-primary placeholder-text-secondary"
          />
          
          {loading && (
            <div className="flex items-center px-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
            </div>
          )}
        </div>
        
        <div className="text-xs text-text-secondary mt-2">
          💡 Try: "show me blues practice", "when did I last work on barre chords", "difficult songs I'm learning"
        </div>
      </div>
      
      {/* Search Results */}
      {isExpanded && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-10 mt-2 bg-surface border border-border rounded-lg shadow-xl max-h-96 overflow-y-auto">
          <div className="p-3 border-b border-border">
            <div className="text-sm font-semibold text-text-primary">
              Found {results.length} relevant {results.length === 1 ? 'item' : 'items'}
            </div>
          </div>
          
          {results.map((result) => (
            <div
              key={`${result.type}-${result.id}`}
              onClick={() => handleResultClick(result)}
              className="p-3 hover:bg-background cursor-pointer border-b border-border/50 last:border-b-0"
            >
              <div className="flex items-start space-x-3">
                <div className="text-lg flex-shrink-0">{getResultIcon(result.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <h4 className="font-semibold text-text-primary truncate">{result.title}</h4>
                    <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full flex-shrink-0">
                      {getResultTypeLabel(result.type)}
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary line-clamp-2">{result.content}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-xs text-text-secondary">
                      {new Date(result.date).toLocaleDateString()}
                    </span>
                    <span className="text-xs bg-green-900/20 text-green-400 px-2 py-1 rounded-full">
                      {Math.round(result.relevanceScore * 100)}% match
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {isExpanded && query.length > 2 && results.length === 0 && !loading && (
        <div className="absolute top-full left-0 right-0 z-10 mt-2 bg-surface border border-border rounded-lg shadow-xl p-4 text-center">
          <div className="text-text-secondary">
            <div className="text-2xl mb-2">🤔</div>
            <p>No relevant items found for "{query}"</p>
            <p className="text-xs mt-1">Try different keywords or check your spelling</p>
          </div>
        </div>
      )}
      
      {/* Click outside to close */}
      {isExpanded && (
        <div 
          className="fixed inset-0 z-5" 
          onClick={() => setIsExpanded(false)}
        />
      )}
    </div>
  );
};