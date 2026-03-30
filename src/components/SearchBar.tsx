import { useRef, useState } from 'react';
import { Home, Menu, Search, X } from 'lucide-react';
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

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    setInternalQuery(nextValue);
    onChange?.(nextValue);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
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

  const handleBlur = (event: React.FocusEvent) => {
    if (containerRef.current?.contains(event.relatedTarget as Node)) return;
    if (!query.trim()) setIsExpanded(false);
  };

  return (
    <div className="flex w-full items-center justify-between" ref={containerRef}>
      <div className="flex items-center gap-3">
        {onToggleMenu ? (
          <button
            onClick={onToggleMenu}
            className="app-icon-button flex h-11 w-11 items-center justify-center rounded-full md:hidden"
            title="Menu"
          >
            <Menu size={20} className="text-text-primary" />
          </button>
        ) : null}

        {showHomeButton ? (
          <button
            onClick={() => navigate('/')}
            className="app-icon-button hidden h-11 w-11 items-center justify-center rounded-full sm:flex"
            title="Home"
          >
            <Home size={20} className="text-text-primary" />
          </button>
        ) : null}

        <form onSubmit={handleSubmit} className="relative">
          <div
            className={`app-input-shell flex items-center overflow-hidden rounded-full transition-all duration-200 ease-out ${isExpanded ? 'w-[min(28rem,70vw)]' : 'h-11 w-11 cursor-pointer'}`}
            onClick={!isExpanded ? handleExpand : undefined}
          >
            <div className={`flex items-center justify-center shrink-0 ${isExpanded ? 'pl-4' : 'h-11 w-11'}`}>
              <Search size={18} className={isExpanded ? 'text-text-secondary' : 'text-text-primary'} />
            </div>

            <div className={`flex-1 overflow-hidden transition-all duration-200 ${isExpanded ? 'opacity-100' : 'w-0 opacity-0'}`}>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Search songs, artists, or albums..."
                disabled={isLoading}
                className="w-full bg-transparent py-2.5 pl-3 pr-4 text-[14px] text-text-primary placeholder:text-text-muted outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {isExpanded && isLoading ? (
              <div className="mr-4">
                <div className="h-4 w-4 rounded-full border-2 border-text-muted border-t-primary animate-spin" />
              </div>
            ) : null}

            {isExpanded && query && !isLoading ? (
              <button
                type="button"
                onClick={handleClear}
                className="mr-2 flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:text-text-primary"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
};
