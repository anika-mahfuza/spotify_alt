import { useState, useRef, useEffect } from 'react';
import { Search, X, Home, User, ChevronDown, LogOut, Menu } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
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
  const [showUserMenu, setShowUserMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { logout, userProfile, isUserProfileLoading } = useAuth();
  const navigate = useNavigate();

  // Close user menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showUserMenu]);

  // Use passed value if provided, otherwise use internal state
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
    if (containerRef.current?.contains(e.relatedTarget as Node)) {
      return;
    }
    if (!query.trim()) {
      setIsExpanded(false);
    }
  };

  return (
    <div className="flex items-center justify-between w-full" ref={containerRef}>
      <div className="flex items-center gap-3">
        {/* Mobile Menu Button */}
        {onToggleMenu && (
          <button
            onClick={onToggleMenu}
            className="
              md:hidden
              w-10 h-10 bg-white/10 hover:bg-white/15
              backdrop-blur-md
              rounded-full flex items-center justify-center
              transition-all duration-150
              hover:scale-[1.02] active:scale-[0.98]
              border border-white/10 hover:border-white/20
            "
            title="Menu"
          >
            <Menu size={20} className="text-white" />
          </button>
        )}

        {showHomeButton && (
          <button
            onClick={() => navigate('/')}
            className="
              w-10 h-10 bg-white/10 hover:bg-white/15
              backdrop-blur-md
              rounded-full flex items-center justify-center
              transition-all duration-150
              hover:scale-[1.02] active:scale-[0.98]
              border border-white/10 hover:border-white/20
            "
            title="Home"
          >
            <Home size={20} className="text-white" />
          </button>
        )}

        <form onSubmit={handleSubmit} className="relative">
          <div
            className={`
              flex items-center rounded-full overflow-hidden
              transition-all duration-200 ease-out
              backdrop-blur-md
              ${isExpanded 
                ? 'w-80 bg-white/10 border border-white/20' 
                : 'w-10 h-10 bg-white/10 hover:bg-white/15 cursor-pointer border border-white/10 hover:border-white/20'
              }
            `}
            onClick={!isExpanded ? handleExpand : undefined}
          >
            <div className={`
              flex items-center justify-center flex-shrink-0
              ${isExpanded ? 'pl-4' : 'w-10 h-10'}
            `}>
              <Search
                size={18}
                className={`transition-all ${
                  isExpanded 
                    ? 'text-text-muted' 
                    : 'text-white'
                }`}
              />
            </div>

            <div className={`
              flex-1 overflow-hidden transition-all duration-200
              ${isExpanded ? 'opacity-100' : 'opacity-0 w-0'}
            `}>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Search songs, artists, or albums..."
                disabled={isLoading}
                className="
                  w-full py-2.5 pr-4 pl-3
                  bg-transparent
                  text-white text-[14px]
                  placeholder:text-text-muted
                  outline-none
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              />
            </div>

            {isExpanded && isLoading && (
              <div className="mr-4">
                <div className="w-4 h-4 border-2 border-text-muted border-t-white rounded-full animate-spin" />
              </div>
            )}

            {isExpanded && query && !isLoading && (
              <button
                type="button"
                onClick={handleClear}
                className="
                  p-1.5 mr-2 rounded-full
                  hover:bg-white/10 transition-colors
                  group
                "
              >
                <X size={14} className="text-text-muted group-hover:text-white" />
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="
              flex items-center gap-2
              bg-white/10 hover:bg-white/15
              backdrop-blur-md
              rounded-full p-1 pr-3.5
              transition-all duration-150
              hover:scale-[1.02] active:scale-[0.98]
              border border-white/10 hover:border-white/20
            "
          >
            <div className="w-8 h-8 bg-bg-tertiary rounded-full flex items-center justify-center overflow-hidden ring-2 ring-border">
              {userProfile?.images?.[0]?.url ? (
                <img
                  src={userProfile.images[0].url}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-accent-purple to-accent-blue flex items-center justify-center">
                  <User size={16} strokeWidth={2.5} className="text-white" />
                </div>
              )}
            </div>

            <span className="text-white text-sm font-medium max-w-[90px] truncate">
              {isUserProfileLoading ? '...' : (userProfile?.display_name || 'Account')}
            </span>

            <ChevronDown
              size={14}
              strokeWidth={2.5}
              className={`
                text-text-secondary transition-transform duration-150
                ${showUserMenu ? 'rotate-180' : ''}
              `}
            />
          </button>

          {showUserMenu && (
            <div className="
              absolute top-full right-0 mt-2 w-52
              bg-white/10 backdrop-blur-2xl rounded-xl overflow-hidden
              shadow-elevated border border-white/20
              animate-scaleIn z-50
            ">
              <div className="px-4 py-2.5 border-b border-white/10">
                <p className="text-white font-medium text-sm truncate">
                  {isUserProfileLoading ? '...' : (userProfile?.display_name || 'Account')}
                </p>
                {userProfile?.email && (
                  <p className="text-text-muted text-xs truncate">
                    {userProfile.email}
                  </p>
                )}
                {userProfile?.product && (
                  <p className="text-primary text-xs mt-0.5 capitalize">
                    {userProfile.product}
                  </p>
                )}
              </div>

              <div className="py-1.5">
                {userProfile?.external_urls?.spotify && (
                  <a
                    href={userProfile.external_urls.spotify}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setShowUserMenu(false)}
                    className="
                      w-full flex items-center gap-2.5 px-4 py-2
                      hover:bg-white/10 transition-colors
                      text-text-secondary hover:text-white
                    "
                  >
                    <User size={16} strokeWidth={2} />
                    <span className="text-sm font-medium">View Profile</span>
                  </a>
                )}

                <div className="my-1.5 mx-2 border-t border-white/10"></div>

                <button
                  onClick={() => {
                    logout();
                    setShowUserMenu(false);
                  }}
                  className="
                    w-full flex items-center gap-2.5 px-4 py-2
                    hover:bg-white/10 transition-colors
                    text-text-secondary hover:text-white
                  "
                >
                  <LogOut size={16} strokeWidth={2} />
                  <span className="text-sm font-medium">Log out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
