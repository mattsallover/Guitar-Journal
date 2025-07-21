import React from 'react';

interface UploadProgressProps {
  files: {
    name: string;
    progress: number;
    status: 'uploading' | 'compressing' | 'completed' | 'error';
    error?: string;
    originalSize?: number;
    compressedSize?: number;
  }[];
  onCancel?: () => void;
}

export const UploadProgress: React.FC<UploadProgressProps> = ({ files, onCancel }) => {
  const totalProgress = files.reduce((sum, file) => sum + file.progress, 0) / files.length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4">
      <div className="bg-surface rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center p-4 border-b border-border">
          <h3 className="text-lg font-bold text-text-primary">
            Uploading Media Files
          </h3>
          {onCancel && (
            <button 
              onClick={onCancel}
              className="text-text-secondary hover:text-text-primary"
            >
              &times;
            </button>
          )}
        </div>
        
        <div className="p-4 space-y-4">
          {/* Overall Progress */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-text-secondary">Overall Progress</span>
              <span className="text-sm font-medium">{Math.round(totalProgress)}%</span>
            </div>
            <div className="w-full bg-background rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${totalProgress}%` }}
              ></div>
            </div>
          </div>

          {/* Individual File Progress */}
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {files.map((file, index) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-text-primary truncate pr-2">
                    {file.name}
                  </span>
                  <div className="flex items-center space-x-2">
                    {file.status === 'compressing' && (
                      <span className="text-xs text-yellow-400">Compressing...</span>
                    )}
                    {file.status === 'uploading' && (
                      <span className="text-xs text-blue-400">Uploading...</span>
                    )}
                    {file.status === 'completed' && (
                      <span className="text-xs text-green-400">✓ Done</span>
                    )}
                    {file.status === 'error' && (
                      <span className="text-xs text-red-400">✗ Error</span>
                    )}
                  </div>
                </div>
                
                <div className="w-full bg-background rounded-full h-1.5">
                  <div 
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      file.status === 'error' ? 'bg-red-500' :
                      file.status === 'completed' ? 'bg-green-500' :
                      file.status === 'compressing' ? 'bg-yellow-500' :
                      'bg-blue-500'
                    }`}
                    style={{ width: `${file.progress}%` }}
                  ></div>
                </div>

                {file.originalSize && file.compressedSize && (
                  <div className="text-xs text-text-secondary">
                    Size: {formatFileSize(file.originalSize)} → {formatFileSize(file.compressedSize)}
                    <span className="text-green-400 ml-1">
                      ({Math.round((1 - file.compressedSize / file.originalSize) * 100)}% smaller)
                    </span>
                  </div>
                )}

                {file.error && (
                  <div className="text-xs text-red-400">{file.error}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};