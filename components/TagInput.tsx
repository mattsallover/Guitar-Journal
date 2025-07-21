import React, { useState, useRef, useEffect } from 'react';
import { SmartInput } from './SmartInput';

interface TagInputProps {
  values: string[];
  onChange: (values: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  smartField?: string;
}

export const TagInput: React.FC<TagInputProps> = ({ values, onChange, suggestions = [], placeholder, smartField }) => {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (e.target.value) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const addValue = (value: string) => {
    const trimmedValue = value.trim();
    if (trimmedValue && !values.includes(trimmedValue)) {
      onChange([...values, trimmedValue]);
    }
    setInputValue('');
    setShowSuggestions(false);
  };

  const removeValue = (valueToRemove: string) => {
    onChange(values.filter(value => value !== valueToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addValue(inputValue);
    } else if (e.key === 'Backspace' && inputValue === '') {
      if (values.length > 0) {
        removeValue(values[values.length - 1]);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };
  
  const filteredSuggestions = suggestions.filter(suggestion =>
    suggestion.toLowerCase().includes(inputValue.toLowerCase()) &&
    !values.includes(suggestion)
  ).slice(0, 5);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [containerRef]);

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex flex-wrap items-center w-full bg-background p-1 rounded-md border border-border focus-within:ring-2 focus-within:ring-primary">
        {values.map(value => (
          <div key={value} className="flex items-center bg-primary/20 text-blue-300 rounded-full m-1 px-3 py-1 text-sm">
            <span>{value}</span>
            <button
              onClick={() => removeValue(value)}
              className="ml-2 text-blue-300 hover:text-white"
            >
              &times;
            </button>
          </div>
        ))}
        {smartField ? (
          <SmartInput
            field={smartField}
            value={inputValue}
            onChange={setInputValue}
            placeholder={values.length > 0 ? '' : placeholder}
            className="flex-grow bg-transparent p-1 focus:outline-none min-w-[120px] h-8"
          />
        ) : (
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => inputValue && setShowSuggestions(true)}
            placeholder={values.length > 0 ? '' : placeholder}
            className="flex-grow bg-transparent p-1 focus:outline-none min-w-[120px] h-8"
          />
        )}
      </div>
      {!smartField && showSuggestions && filteredSuggestions.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-surface border border-border rounded-md shadow-lg max-h-60 overflow-auto">
          {filteredSuggestions.map(suggestion => (
            <li
              key={suggestion}
              onClick={() => addValue(suggestion)}
              className="px-4 py-2 cursor-pointer hover:bg-primary/20"
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
