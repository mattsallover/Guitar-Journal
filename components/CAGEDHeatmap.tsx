import React, { useMemo } from 'react';
import { CAGEDSession, CagedShape, Note } from '../types';
import { generateHeatmapData, analyzeShapePerformance, analyzeNotePerformance, getPerformanceSummary } from '../utils/cagedAnalytics';
import { ALL_NOTES } from '../constants';

interface CAGEDHeatmapProps {
  sessions: CAGEDSession[];
}

export const CAGEDHeatmap: React.FC<CAGEDHeatmapProps> = ({ sessions }) => {
  const heatmapData = useMemo(() => generateHeatmapData(sessions), [sessions]);
  const shapePerformance = useMemo(() => analyzeShapePerformance(sessions), [sessions]);
  const notePerformance = useMemo(() => analyzeNotePerformance(sessions), [sessions]);
  const summary = useMemo(() => getPerformanceSummary(sessions), [sessions]);
  
  if (sessions.length === 0) {
    return (
      <div className="bg-surface p-8 rounded-lg text-center">
        <h2 className="text-xl font-bold mb-2">CAGED Performance Analysis</h2>
        <p className="text-text-secondary">Complete some CAGED quiz sessions to see your performance heatmap!</p>
        <div className="mt-4 text-4xl">🎸</div>
      </div>
    );
  }
  
  const shapes: CagedShape[] = ['C', 'A', 'G', 'E', 'D'];
  
  return (
    <div className="space-y-6">
      {/* Performance Summary */}
      <div className="bg-surface p-6 rounded-lg">
        <h2 className="text-xl font-bold mb-4">CAGED Performance Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{summary.totalSessions}</div>
            <div className="text-sm text-text-secondary">Sessions</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{summary.avgScore}/100</div>
            <div className="text-sm text-text-secondary">Avg Score</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-400">
              {summary.strongestShape?.shape || 'N/A'}
            </div>
            <div className="text-sm text-text-secondary">Strongest Shape</div>
            {summary.strongestShape && (
              <div className="text-xs text-text-secondary">
                {Math.round(summary.strongestShape.accuracyRate * 100)}% accuracy
              </div>
            )}
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-red-400">
              {summary.weakestShape?.shape || 'N/A'}
            </div>
            <div className="text-sm text-text-secondary">Needs Work</div>
            {summary.weakestShape && (
              <div className="text-xs text-text-secondary">
                {Math.round(summary.weakestShape.accuracyRate * 100)}% accuracy
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Shape Performance Bars */}
      <div className="bg-surface p-6 rounded-lg">
        <h3 className="text-lg font-bold mb-4">Shape Performance</h3>
        <div className="space-y-3">
          {shapes.map(shape => {
            const perf = shapePerformance.find(p => p.shape === shape);
            const accuracy = perf ? perf.accuracyRate * 100 : 0;
            const attempts = perf ? perf.totalAttempts : 0;
            
            return (
              <div key={shape} className="flex items-center space-x-4">
                <div className="w-12 text-center font-bold text-primary">{shape}</div>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-text-secondary">
                      {attempts} attempts • {Math.round(accuracy)}% accuracy
                    </span>
                  </div>
                  <div className="w-full bg-background rounded-full h-3">
                    <div 
                      className={`h-3 rounded-full transition-all ${
                        accuracy >= 80 ? 'bg-green-500' :
                        accuracy >= 60 ? 'bg-yellow-500' :
                        accuracy >= 40 ? 'bg-orange-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${accuracy}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Heatmap */}
      <div className="bg-surface p-6 rounded-lg">
        <h3 className="text-lg font-bold mb-4">Shape × Note Performance Heatmap</h3>
        <p className="text-sm text-text-secondary mb-4">
          Green = Strong • Yellow = Good • Orange = OK • Red = Needs Work • Gray = No Data
        </p>
        
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Header with notes */}
            <div className="flex">
              <div className="w-12 h-8"></div> {/* Empty corner */}
              {ALL_NOTES.map(note => (
                <div key={note} className="w-8 h-8 text-xs font-medium text-center flex items-center justify-center text-text-secondary">
                  {note}
                </div>
              ))}
            </div>
            
            {/* Rows for each shape */}
            {shapes.map(shape => (
              <div key={shape} className="flex">
                <div className="w-12 h-8 text-sm font-bold text-center flex items-center justify-center text-primary">
                  {shape}
                </div>
                {ALL_NOTES.map(note => {
                  const cell = heatmapData.find(c => c.shape === shape && c.note === note);
                  const accuracy = cell ? Math.round(cell.accuracy * 100) : 0;
                  const attempts = cell ? cell.attempts : 0;
                  
                  return (
                    <div 
                      key={`${shape}-${note}`}
                      className="w-8 h-8 border border-border/20 text-xs flex items-center justify-center cursor-pointer hover:scale-110 transition-transform"
                      style={{ backgroundColor: cell?.color || '#374151' }}
                      title={attempts > 0 ? `${shape}${note}: ${accuracy}% (${attempts} attempts)` : `${shape}${note}: No data`}
                    >
                      {attempts > 0 && (
                        <span className="text-white font-bold text-xs">
                          {accuracy}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Top Notes Performance */}
      <div className="bg-surface p-6 rounded-lg">
        <h3 className="text-lg font-bold mb-4">Note Performance</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {notePerformance
            .filter(n => n.totalAttempts > 0)
            .sort((a, b) => b.accuracyRate - a.accuracyRate)
            .map(note => (
              <div key={note.note} className="text-center p-3 bg-background rounded-md">
                <div className="text-lg font-bold text-primary">{note.note}</div>
                <div className="text-sm text-text-secondary">
                  {Math.round(note.accuracyRate * 100)}%
                </div>
                <div className="text-xs text-text-secondary">
                  {note.totalAttempts} attempts
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};