export interface Track {
  id: string;
  name: string;
  artist: string;
  album: string;
  duration_ms: number;
  image?: string;
  thumbnail?: string;
  isYoutube?: boolean;
  youtubeId?: string;
  youtubeCandidates?: string[];
  playbackNonce?: number;
}

export interface ImportedTrack {
  name: string;
  artist: string;
  album: string;
  image: string;
  duration: string;
  url: string;
}

export interface ImportedPlaylist {
  id: string;
  name: string;
  description?: string;
  owner?: string;
  image?: string;
  trackCount: number;
  tracks: ImportedTrack[];
  sourceUrl: string;
  importedAt: number;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  image?: string;
  images?: Array<{ url: string }>;
  owner?: {
    display_name?: string;
  };
}

export interface Artist {
  id: string;
  name: string;
  images?: Array<{ url: string }>;
  genres?: string[];
  followers?: { total: number };
  popularity?: number;
}

export interface SimplifiedArtist {
  id: string;
  name: string;
  images?: Array<{ url: string }>;
}

export interface Album {
  id: string;
  name: string;
  artists: SimplifiedArtist[];
  images: Array<{ url: string }>;
  release_date: string;
  album_type?: string;
  total_tracks?: number;
}

export interface SpotifyImage {
  url: string;
  width?: number;
  height?: number;
}

export interface RecentlyPlayedItem {
  track: Track;
  played_at: string;
}

export interface BrowseCategory {
  id: string;
  name: string;
  icons?: Array<{ url: string }>;
  playlists?: Playlist[];
}

export interface UserProfile {
  display_name: string;
  email: string;
  external_urls: { spotify: string };
  followers: { href: string | null; total: number };
  href: string;
  id: string;
  images: SpotifyImage[];
  product: string;
  type: string;
  uri: string;
}
