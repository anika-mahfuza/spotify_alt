# Spotify Alt

A modern Spotify alternative web application built with React, TypeScript, and Tailwind CSS. This frontend-only application integrates with the Spotify Web API and YouTube for music streaming.

## Overview

Spotify Alt provides a full-featured music streaming interface that connects to Spotify for library management and YouTube for audio streaming. The application features a sleek dark UI with dynamic theming, responsive design, and smooth animations.

## Tech Stack

- **Frontend Framework**: React 19 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS with custom dark theme
- **Routing**: React Router v7
- **Icons**: Lucide React
- **State Management**: React Context API
- **Authentication**: OAuth 2.0 with Spotify

## Architecture

### Project Structure

```
src/
├── api/                    # API layer
│   ├── client.ts          # HTTP client with auth
│   ├── endpoints.ts       # API endpoint definitions
│   ├── types.ts          # API response types
│   ├── spotify.ts        # Spotify API service
│   ├── backend.ts        # Backend API service
│   └── index.ts          # Module exports
├── components/            # React components
│   ├── App.tsx           # Main app with routing
│   ├── Home.tsx          # Dashboard view
│   ├── Player.tsx        # Audio player controls
│   ├── Sidebar.tsx       # Navigation sidebar
│   ├── SearchBar.tsx     # Global search
│   ├── ResultList.tsx    # Search results
│   ├── NowPlayingSidebar.tsx  # Queue & artist info
│   ├── DynamicBackground.tsx  # Blurred album art background
│   └── Spotlight.tsx     # Mouse-following spotlight effect
├── context/              # React contexts
│   └── AuthContext.tsx   # Authentication state
├── hooks/                # Custom React hooks
│   ├── useAuth.ts        # Auth context hook
│   ├── useSpotifyFetch.ts # API request hook
│   ├── useData.ts        # Generic data fetching
│   ├── usePlaylists.ts   # Playlist data hooks
│   ├── useDashboard.ts   # Dashboard data hooks
│   ├── useSearch.ts      # Search hooks
│   └── index.ts          # All hooks exports
├── types.ts             # TypeScript types
├── config.ts            # App configuration
├── utils/               # Utility functions
│   └── colorExtractor.ts # Album art color extraction
└── index.css            # Global styles
```

## API Layer

The application uses a comprehensive API layer to handle all external communication:

### HTTP Client (`api/client.ts`)

The `ApiClient` class provides:
- Automatic token injection
- Request timeout handling (15s default)
- 401 retry logic with token refresh
- Query parameter building
- AbortController for request cancellation

```typescript
// Two clients are created:
const spotifyClient = new ApiClient({
  baseURL: 'https://api.spotify.com/v1',
  timeout: 15000,
});

const backendClient = new ApiClient({
  baseURL: config.API_URL,
  timeout: 30000,
});
```

### Spotify API (`api/spotify.ts`)

All Spotify Web API endpoints organized by category:

**User**
- `getUserProfile()` - Get current user info
- `getRecentlyPlayed(limit)` - Recently played tracks

**Browse**
- `getFeaturedPlaylists(limit)` - Featured playlists
- `getNewReleases(limit)` - New album releases
- `getBrowseCategories(limit)` - Browse categories
- `getCategoryPlaylists(categoryId, limit)` - Playlists in category

**Artists**
- `getArtist(id)` - Artist details
- `getArtistTopTracks(id, market)` - Artist's top tracks
- `getArtistAlbums(id, includeGroups, limit)` - Artist's albums

**Playlists**
- `getUserPlaylists(limit)` - User's playlists
- `getPlaylist(id)` - Playlist details
- `getPlaylistTracks(id)` - Tracks in playlist

**Library**
- `getSavedTracks(limit)` - Liked songs
- `getSavedAlbums(limit)` - Saved albums
- `getFollowedArtists(limit)` - Followed artists
- `getTopTracks(timeRange, limit)` - User's top tracks
- `getTopArtists(timeRange, limit)` - User's top artists

**Search**
- `searchSpotify(query, type, limit)` - Multi-type search

### Backend API (`api/backend.ts`)

All backend API endpoints:

**Auth**
- `refreshToken(refreshTokenValue)` - Refresh access token
- `getLoginUrl(frontendUrl)` - Generate login URL

**Search & Stream**
- `searchYouTube(query)` - Search YouTube videos
- `searchAndPlay(query)` - Search and get playable track
- `getPlayUrl(videoId)` - Get audio stream URL
- `getStreamUrl(videoId)` - Get stream with metadata

**Playlists & Albums**
- `getBackendPlaylists()` - Get playlists from backend
- `getBackendPlaylist(id)` - Get playlist tracks
- `getBackendAlbum(id)` - Get album details

**User Data**
- `getMadeForYou()` - Personalized playlists
- `getBackendTopTracks()` - Top tracks
- `getBackendTopArtists()` - Top artists
- `getBackendRecommendations()` - Recommended tracks
- `getBackendSavedAlbums()` - Saved albums
- `getBackendSavedTracks()` - Saved tracks
- `getBackendFollowedArtists()` - Followed artists
- `getBackendBrowseCategories()` - Browse categories
- `getBackendArtistDetails(artistName)` - Artist with albums

## Authentication Flow

The app uses Spotify OAuth 2.0 for authentication:

1. User clicks "Login" → Redirected to backend `/login`
2. Backend redirects to Spotify authorization
3. User authorizes → Spotify redirects to backend `/callback`
4. Backend redirects back to frontend with tokens in URL
5. Frontend extracts tokens and stores in localStorage
6. Token auto-refresh 1 minute before expiry

**Token Storage:**
- `spotify_token` - Access token
- `spotify_refresh_token` - Refresh token
- `spotify_token_expires_at` - Expiration timestamp

## Data Fetching Hooks

Custom hooks for clean data fetching:

### useData

Generic data fetching with loading/error states:

```typescript
const { data, isLoading, error, refetch, setData } = useData(
  () => fetchUserProfile(),
  { enabled: true }
);
```

### useLazyData

Lazy data fetching (manual execution):

```typescript
const { data, isLoading, execute } = useLazyData(
  (query) => searchYouTube(query)
);

// Later:
execute("search query");
```

### Dashboard Hook

Fetches all dashboard data at once:

```typescript
const {
  recentlyPlayed,
  featuredPlaylists,
  newReleases,
  madeForYou,
  topTracks,
  topArtists,
  recommendations,
  savedAlbums,
  userPlaylists,
  browseCategories,
  savedTracks,
  followedArtists,
  isLoading,
} = useDashboard();
```

## Components

### App.tsx

Main application component with:
- React Router routing
- Authentication check
- Global state management
- Dynamic background

**Routes:**
- `/` - Home (dashboard)
- `/playlist/:id` - Playlist view
- `/album/:id` - Album view
- `/artist/:id` - Artist view
- `/collection/tracks` - Liked songs
- `/search` - Search results

### Home.tsx

Dashboard component displaying:
- Recently played tracks
- Made for you playlists
- Recommendations
- Top tracks/artists
- Saved albums/playlists
- Featured playlists
- New releases
- Browse categories

Features:
- Horizontal scrolling sections
- Search within playlist
- Play button on hover
- Dynamic gradient header

### Player.tsx

Audio player with:
- Audio controls (play/pause, skip, previous)
- Progress bar with seek
- Volume control
- Now playing info
- Queue toggle
- Shuffle/repeat buttons

Features:
- Keyboard shortcuts (space to play/pause)
- LocalStorage state persistence
- Queue management (add, remove, reorder)
- Loading states

### Sidebar.tsx

Navigation sidebar with:
- Logo/home link
- Library links (Home, Liked Songs)
- User playlists list
- Active state indicators

Features:
- Collapsible on mobile
- Responsive design
- Loading skeletons

### SearchBar.tsx

Global search with:
- Expandable search input
- Home button
- User menu dropdown
- Profile info display

Features:
- Search on Enter
- Clear button
- Outside click handling

### ResultList.tsx

Displays YouTube search results:
- Thumbnail with duration
- Title and uploader
- Play/pause button
- Hover effects

### NowPlayingSidebar.tsx

Right sidebar showing:
- Current track artwork
- Track info
- Artist details
- Upcoming queue

Features:
- Resizable (drag handle)
- Queue item removal
- Click to play from queue
- Mobile responsive

### DynamicBackground.tsx

Blurred album art background:
- Extracts dominant color from artwork
- Smooth transitions between tracks
- Radial gradient overlay
- Scale animation

### Spotlight.tsx

Mouse-following spotlight effect:
- Follows cursor position
- Smooth interpolation
- Ambient top glow
- Vignette overlay

## State Management

### AuthContext

Manages authentication state:

```typescript
interface AuthContextType {
  token: string | null;
  login: () => void;
  logout: () => void;
  isAuthenticated: boolean;
  userProfile: UserProfile | null;
  isUserProfileLoading: boolean;
  getAccessToken: () => Promise<string | null>;
}
```

**Features:**
- Automatic token refresh
- Profile fetching
- Logout cleanup
- Token validity checking

### Player State

Player state managed in App.tsx:

```typescript
interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  queue: Track[];
  currentIndex: number;
  isShuffled: boolean;
  repeatMode: 'off' | 'all' | 'one';
}
```

**Persistence:**
- Saved to localStorage on change
- Restored on app load
- Queue maintained between sessions

## Types

Core TypeScript types:

```typescript
interface Track {
  id: string;
  name: string;
  artist: string;
  album: string;
  duration_ms: number;
  image?: string;
  thumbnail?: string;
  isYoutube?: boolean;
}

interface Playlist {
  id: string;
  name: string;
  description?: string;
  images?: Array<{ url: string }>;
  owner?: { display_name?: string };
}

interface Artist {
  id: string;
  name: string;
  images?: Array<{ url: string }>;
  genres?: string[];
  followers?: { total: number };
  popularity?: number;
}

interface Album {
  id: string;
  name: string;
  artists: Array<{ name: string; id: string }>;
  images: Array<{ url: string }>;
  release_date: string;
}

interface UserProfile {
  display_name: string;
  email: string;
  images: Array<{ url: string }>;
  product: string;
  followers: { total: number };
  external_urls: { spotify: string };
}
```

## Configuration

### Environment Variables

Create `.env` file:

```env
VITE_API_URL=http://127.0.0.1:11946    # Backend API URL
VITE_FRONTEND_URL=http://localhost:5173  # Frontend URL
```

### Tailwind Configuration

Custom theme in `tailwind.config.js`:

```javascript
colors: {
  primary: {
    DEFAULT: 'var(--accent-color, #1DB954)',
    hover: 'var(--spice-button-active, #1ed760)',
  },
  bg: {
    base: '#000000',
    primary: '#121212',
    secondary: '#181818',
    tertiary: '#1E1E1E',
  },
  text: {
    primary: '#FFFFFF',
    secondary: '#B3B3B3',
    muted: '#9A9A9A',
  },
}
```

## Scripts

```bash
# Development
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## Features

- **Dynamic Theming**: Accent color extracted from album artwork
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Keyboard Shortcuts**: Space to play/pause
- **Queue Management**: Add, remove, reorder tracks
- **Search**: Search YouTube for any song
- **Spotify Integration**: Full library access
- **Persistent State**: Player state saved to localStorage
- **Smooth Animations**: Transitions and hover effects
- **Type Safety**: Full TypeScript coverage

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Development

### Prerequisites

- Node.js 18+
- npm or yarn
- Spotify Developer Account (for API access)

### Setup

1. Clone repository
2. Install dependencies: `npm install`
3. Create `.env` file with API URLs
4. Start dev server: `npm run dev`
5. Open http://localhost:5173

### Adding Backend

When ready to add a backend:

1. Update `VITE_API_URL` in `.env`
2. Backend will receive authenticated requests automatically
3. API services in `api/backend.ts` will work immediately
4. No component changes needed

## API Endpoints Reference

### Spotify Web API

Base URL: `https://api.spotify.com/v1`

All endpoints require Bearer token authentication.

### Backend API

Base URL: Configurable via `VITE_API_URL`

Authentication via query parameter: `?token=ACCESS_TOKEN`

**Required Endpoints:**
- `GET /login` - OAuth initiation
- `GET /callback` - OAuth callback
- `GET /refresh-token?refresh_token=TOKEN` - Token refresh
- `GET /search?q=QUERY` - YouTube search
- `GET /play/:videoId` - Get stream URL
- `GET /playlist/:id` - Playlist tracks
- `GET /album/:id` - Album tracks
- `GET /made-for-you` - Personalized playlists
- `GET /top-tracks` - User's top tracks
- `GET /top-artists` - User's top artists
- `GET /recommendations` - Recommended tracks
- `GET /saved-albums` - Saved albums
- `GET /saved-tracks` - Saved tracks
- `GET /followed-artists` - Followed artists
- `GET /browse-categories` - Browse categories
- `GET /playlists` - User playlists
- `GET /artist-details?artistName=NAME` - Artist details

## License

MIT

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature/name`
5. Submit pull request

## Credits

- Built with React and Vite
- Icons by Lucide
- Styling with Tailwind CSS
- Spotify Web API
- YouTube for audio streaming
