import { useState } from 'react';
import { Search } from 'lucide-react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
}

export const SearchBar = ({ onSearch, isLoading }: SearchBarProps) => {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
          <Search 
            size={20} 
            className={`transition-colors ${
              isFocused ? 'text-white' : 'text-spotify-text-gray'
            }`}
          />
        </div>
        
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="What do you want to listen to?"
          disabled={isLoading}
          className="
            w-full pl-12 pr-4 py-3 
            bg-[#242424] hover:bg-[#2a2a2a]
            rounded-full 
            text-white text-sm
            placeholder:text-spotify-text-gray
            border-2 border-transparent
            focus:border-white focus:bg-[#333]
            outline-none
            transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        />
      </div>
    </form>
  );
};
