import { useState, useRef } from 'react';
import { Search, X, Home, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
  value?: string;
  onChange?: (value: string) => void;
  showHomeButton?: boolean;
  onToggleMenu?: () => void;
}

export const SearchBar = ({ onSearch, isLoading, value, onChange, showHomeButton, onToggleMenu }: SearchBarProps) => {
  const [internalQuery, setInternalQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const query = value !== undefined ? value : internalQuery;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInternalQuery(newValue);
    onChange?.(newValue);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
    }
  };

  const handleExpand = () => {
    setIsExpanded(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleClear = () => {
    setInternalQuery('');
    onChange?.('');
    inputRef.current?.focus();
  };

  const handleBlur = (e: React.FocusEvent) => {
    if (containerRef.current?.contains(e.relatedTarget as Node)) return;
    if (!query.trim()) setIsExpanded(false);
  };

  return (
    <div className="flex items-center justify-between w-full" ref={containerRef}>
      <div className="flex items-center gap-3">
        {onToggleMenu && (
          <button
            onClick={onToggleMenu}
            className="md:hidden w-10 h-10 bg-white/10 hover:bg-white/15 backdrop-blur-md rounded-full flex items-center justify-center transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] border border-white/10 hover:border-white/20"
            title="Menu"
          >
            <Menu size={20} className="text-white" />
          </button>
        )}

        {showHomeButton && (
          <button
            onClick={() => navigate('/')}
            className="w-10 h-10 bg-white/10 hover:bg-white/15 backdrop-blur-md rounded-full flex items-center justify-center transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] border border-white/10 hover:border-white/20"
            title="Home"
          >
            <Home size={20} className="text-white" />
          </button>
        )}

        <form onSubmit={handleSubmit} className="relative">
          <div
            className={`flex items-center rounded-full overflow-hidden transition-all duration-200 ease-out backdrop-blur-md ${isExpanded ? 'w-80 bg-white/10 border border-white/20' : 'w-10 h-10 bg-white/10 hover:bg-white/15 cursor-pointer border border-white/10 hover:border-white/20'}`}
            onClick={!isExpanded ? handleExpand : undefined}
          >
            <div className={`flex items-center justify-center flex-shrink-0 ${isExpanded ? 'pl-4' : 'w-10 h-10'}`}>
              <Search size={18} className={`transition-all ${isExpanded ? 'text-text-muted' : 'text-white'}`} />
            </div>

            <div className={`flex-1 overflow-hidden transition-all duration-200 ${isExpanded ? 'opacity-100' : 'opacity-0 w-0'}`}>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Search songs, artists, or albums..."
                disabled={isLoading}
                className="w-full py-2.5 pr-4 pl-3 bg-transparent text-white text-[14px] placeholder:text-text-muted outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {isExpanded && isLoading && (
              <div className="mr-4">
                <div className="w-4 h-4 border-2 border-text-muted border-t-white rounded-full animate-spin" />
              </div>
            )}

            {isExpanded && query && !isLoading && (
              <button type="button" onClick={handleClear} className="p-1.5 mr-2 rounded-full hover:bg-white/10 transition-colors group">
                <X size={14} className="text-text-muted group-hover:text-white" />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
