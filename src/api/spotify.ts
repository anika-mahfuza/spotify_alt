/**
 * Spotify API Service
 * 
 * All Spotify Web API calls are centralized here.
 * Uses the spotifyClient with automatic token injection.
 */

import { spotifyClient } from './client';
import { SPOTIFY_ENDPOINTS, DEFAULT_PARAMS } from './endpoints';
import {
  SpotifyRecentlyPlayedResponse,
  SpotifyFeaturedPlaylistsResponse,
  SpotifyNewReleasesResponse,
  SpotifyArtistTopTracksResponse,
  SpotifyArtistAlbumsResponse,
  SpotifyPlaylistResponse,
  SpotifyBrowseCategoriesResponse,
  SpotifyCategoryPlaylistsResponse,
  SpotifyTrackResponse,
} from './types';
import { Track, Playlist, Album, Artist, UserProfile } from '../types';

// ==================== USER ====================

export const getUserProfile = async (): Promise<UserProfile> => {
  return spotifyClient.get<UserProfile>(SPOTIFY_ENDPOINTS.ME);
};

// ==================== PLAYER ====================

export const getRecentlyPlayed = async (limit: number = DEFAULT_PARAMS.LIMIT.MEDIUM): Promise<Track[]> => {
  const response = await spotifyClient.get<SpotifyRecentlyPlayedResponse>(
    SPOTIFY_ENDPOINTS.RECENTLY_PLAYED,
    {
      params: { limit },
    }
  );

  // Deduplicate tracks
  const seen = new Set<string>();
  const uniqueItems = response.items.filter((item) => {
    if (!item?.track?.id || seen.has(item.track.id)) return false;
    seen.add(item.track.id);
    return true;
  });

  return uniqueItems.map((item) => ({
    id: item.track.id,
    name: item.track.name,
    artist: item.track.artists?.map((a) => a.name).join(', ') || 'Unknown',
    album: item.track.album?.name || 'Unknown',
    duration_ms: item.track.duration_ms || 0,
    image: item.track.album?.images?.[0]?.url,
  }));
};

// ==================== BROWSE ====================

export const getFeaturedPlaylists = async (limit: number = DEFAULT_PARAMS.LIMIT.MEDIUM): Promise<Playlist[]> => {
  const response = await spotifyClient.get<SpotifyFeaturedPlaylistsResponse>(
    SPOTIFY_ENDPOINTS.FEATURED_PLAYLISTS,
    {
      params: { limit },
    }
  );
  
  return response.playlists?.items?.filter((p: Playlist) => p && p.id) || [];
};

export const getNewReleases = async (limit: number = DEFAULT_PARAMS.LIMIT.MEDIUM): Promise<Album[]> => {
  const response = await spotifyClient.get<SpotifyNewReleasesResponse>(
    SPOTIFY_ENDPOINTS.NEW_RELEASES,
    {
      params: { limit },
    }
  );
  
  return response.albums?.items?.filter((a: Album) => a && a.id) || [];
};

export const getBrowseCategories = async (limit: number = 20): Promise<Array<{ id: string; name: string; icons?: Array<{ url: string }> }>> => {
  const response = await spotifyClient.get<SpotifyBrowseCategoriesResponse>(
    SPOTIFY_ENDPOINTS.BROWSE_CATEGORIES,
    {
      params: { limit },
    }
  );
  
  return response.categories?.items || [];
};

export const getCategoryPlaylists = async (categoryId: string, limit: number = DEFAULT_PARAMS.LIMIT.MEDIUM): Promise<Playlist[]> => {
  const response = await spotifyClient.get<SpotifyCategoryPlaylistsResponse>(
    SPOTIFY_ENDPOINTS.CATEGORY_PLAYLISTS(categoryId),
    {
      params: { limit },
    }
  );
  
  return response.playlists?.items?.filter((p: Playlist) => p && p.id) || [];
};

// ==================== ARTISTS ====================

export const getArtist = async (id: string): Promise<Artist> => {
  return spotifyClient.get<Artist>(SPOTIFY_ENDPOINTS.ARTIST(id));
};

export const getArtistTopTracks = async (id: string, market: string = DEFAULT_PARAMS.MARKET): Promise<Track[]> => {
  const response = await spotifyClient.get<SpotifyArtistTopTracksResponse>(
    SPOTIFY_ENDPOINTS.ARTIST_TOP_TRACKS(id),
    {
      params: { market },
    }
  );
  
  return response.tracks.map((track) => ({
    id: track.id,
    name: track.name,
    artist: track.artists?.map((a) => a.name).join(', ') || 'Unknown',
    album: track.album?.name || 'Unknown',
    duration_ms: track.duration_ms || 0,
    image: track.album?.images?.[0]?.url,
  }));
};

export const getArtistAlbums = async (
  id: string,
  includeGroups: string = 'album,single',
  limit: number = 50
): Promise<Album[]> => {
  const response = await spotifyClient.get<SpotifyArtistAlbumsResponse>(
    SPOTIFY_ENDPOINTS.ARTIST_ALBUMS(id),
    {
      params: { include_groups: includeGroups, limit },
    }
  );
  
  // Deduplicate albums by name
  const uniqueAlbums = new Map<string, Album>();
  response.items.forEach((album: Album) => {
    if (!uniqueAlbums.has(album.name)) {
      uniqueAlbums.set(album.name, album);
    }
  });
  
  return Array.from(uniqueAlbums.values());
};

// ==================== PLAYLISTS ====================

export const getPlaylist = async (id: string): Promise<SpotifyPlaylistResponse> => {
  return spotifyClient.get<SpotifyPlaylistResponse>(SPOTIFY_ENDPOINTS.PLAYLIST(id));
};

export const getPlaylistTracks = async (id: string): Promise<Track[]> => {
  const playlist = await getPlaylist(id);
  
  return playlist.tracks.items
    .filter((item) => item.track)
    .map((item) => ({
      id: item.track.id,
      name: item.track.name,
      artist: item.track.artists?.map((a) => a.name).join(', ') || 'Unknown',
      album: item.track.album?.name || 'Unknown',
      duration_ms: item.track.duration_ms || 0,
      image: item.track.album?.images?.[0]?.url,
    }));
};

// ==================== LIBRARY ====================

export const getUserPlaylists = async (limit: number = 50): Promise<Playlist[]> => {
  const response = await spotifyClient.get<{ items: Playlist[] }>(
    SPOTIFY_ENDPOINTS.USER_PLAYLISTS,
    {
      params: { limit },
    }
  );
  
  return response.items?.filter((p) => p && p.id) || [];
};

export const getSavedTracks = async (limit: number = 50): Promise<Track[]> => {
  const response = await spotifyClient.get<{ items: Array<{ track: SpotifyTrackResponse }> }>(
    SPOTIFY_ENDPOINTS.SAVED_TRACKS,
    {
      params: { limit },
    }
  );
  
  return response.items?.map((item) => ({
    id: item.track.id,
    name: item.track.name,
    artist: item.track.artists?.map((a) => a.name).join(', ') || 'Unknown',
    album: item.track.album?.name || 'Unknown',
    duration_ms: item.track.duration_ms || 0,
    image: item.track.album?.images?.[0]?.url,
  })) || [];
};

export const getSavedAlbums = async (limit: number = 50): Promise<Album[]> => {
  const response = await spotifyClient.get<{ items: Array<{ album: Album }> }>(
    SPOTIFY_ENDPOINTS.SAVED_ALBUMS,
    {
      params: { limit },
    }
  );
  
  return response.items?.map((item) => item.album).filter((a) => a && a.id) || [];
};

export const getFollowedArtists = async (limit: number = 50): Promise<Artist[]> => {
  const response = await spotifyClient.get<{ artists: { items: Artist[] } }>(
    SPOTIFY_ENDPOINTS.FOLLOWED_ARTISTS,
    {
      params: { type: 'artist', limit },
    }
  );
  
  return response.artists?.items?.filter((a) => a && a.id) || [];
};

export const getTopTracks = async (
  timeRange: 'short_term' | 'medium_term' | 'long_term' = 'medium_term',
  limit: number = 50
): Promise<Track[]> => {
  const response = await spotifyClient.get<{ items: SpotifyTrackResponse[] }>(
    SPOTIFY_ENDPOINTS.TOP_TRACKS,
    {
      params: { time_range: timeRange, limit },
    }
  );
  
  return response.items?.map((track) => ({
    id: track.id,
    name: track.name,
    artist: track.artists?.map((a) => a.name).join(', ') || 'Unknown',
    album: track.album?.name || 'Unknown',
    duration_ms: track.duration_ms || 0,
    image: track.album?.images?.[0]?.url,
  })) || [];
};

export const getTopArtists = async (
  timeRange: 'short_term' | 'medium_term' | 'long_term' = 'medium_term',
  limit: number = 50
): Promise<Artist[]> => {
  const response = await spotifyClient.get<{ items: Artist[] }>(
    SPOTIFY_ENDPOINTS.TOP_ARTISTS,
    {
      params: { time_range: timeRange, limit },
    }
  );
  
  return response.items?.filter((a) => a && a.id) || [];
};

// ==================== SEARCH ====================

export const searchSpotify = async (
  query: string,
  type: string = 'track,artist,album,playlist',
  limit: number = 20
): Promise<{
  tracks?: Track[];
  artists?: Artist[];
  albums?: Album[];
  playlists?: Playlist[];
}> => {
  const response = await spotifyClient.get<{
    tracks?: { items: SpotifyTrackResponse[] };
    artists?: { items: Artist[] };
    albums?: { items: Album[] };
    playlists?: { items: Playlist[] };
  }>(
    SPOTIFY_ENDPOINTS.SEARCH,
    {
      params: { q: query, type, limit },
    }
  );
  
  return {
    tracks: response.tracks?.items?.map((track) => ({
      id: track.id,
      name: track.name,
      artist: track.artists?.map((a) => a.name).join(', ') || 'Unknown',
      album: track.album?.name || 'Unknown',
      duration_ms: track.duration_ms || 0,
      image: track.album?.images?.[0]?.url,
    })),
    artists: response.artists?.items?.filter((a) => a && a.id),
    albums: response.albums?.items?.filter((a) => a && a.id),
    playlists: response.playlists?.items?.filter((p) => p && p.id),
  };
};
