/**
 * Dashboard data fetching hooks
 * Fetches all data needed for the home dashboard
 */

import { useData } from './useData';
import { useBackendPlaylists } from './usePlaylists';
import * as spotifyAPI from '../api/spotify';
import * as backendAPI from '../api/backend';
import { Track, Playlist, Album, Artist, BrowseCategory, RecentlyPlayedItem } from '../types';

// ==================== RECENTLY PLAYED ====================

export function useRecentlyPlayed(limit: number = 20) {
  return useData<RecentlyPlayedItem[]>(
    async () => {
      const tracks = await spotifyAPI.getRecentlyPlayed(limit);
      // Convert to RecentlyPlayedItem format
      return tracks.map((track, index) => ({
        track,
        played_at: new Date(Date.now() - index * 3600000).toISOString(), // Mock timestamp
      }));
    },
    { enabled: true }
  );
}

// ==================== FEATURED CONTENT ====================

export function useFeaturedPlaylists(limit: number = 20) {
  return useData<Playlist[]>(
    () => spotifyAPI.getFeaturedPlaylists(limit),
    { enabled: true }
  );
}

export function useNewReleases(limit: number = 20) {
  return useData<Album[]>(
    () => spotifyAPI.getNewReleases(limit),
    { enabled: true }
  );
}

// ==================== MADE FOR YOU ====================

export function useMadeForYou() {
  return useData<Playlist[]>(
    () => backendAPI.getMadeForYou(),
    { enabled: true }
  );
}

// ==================== TOP TRACKS ====================

export function useTopTracks(timeRange: 'short_term' | 'medium_term' | 'long_term' = 'medium_term') {
  return useData<Track[]>(
    () => spotifyAPI.getTopTracks(timeRange),
    { 
      enabled: true,
      deps: [timeRange],
    }
  );
}

export function useBackendTopTracks() {
  return useData<Track[]>(
    () => backendAPI.getBackendTopTracks(),
    { enabled: true }
  );
}

// ==================== TOP ARTISTS ====================

export function useTopArtists(timeRange: 'short_term' | 'medium_term' | 'long_term' = 'medium_term') {
  return useData<Artist[]>(
    () => spotifyAPI.getTopArtists(timeRange),
    { 
      enabled: true,
      deps: [timeRange],
    }
  );
}

export function useBackendTopArtists() {
  return useData<Artist[]>(
    () => backendAPI.getBackendTopArtists(),
    { enabled: true }
  );
}

// ==================== RECOMMENDATIONS ====================

export function useRecommendations() {
  return useData<Track[]>(
    () => backendAPI.getBackendRecommendations(),
    { enabled: true }
  );
}

// ==================== SAVED ALBUMS ====================

export function useSavedAlbums() {
  return useData<Album[]>(
    () => spotifyAPI.getSavedAlbums(),
    { enabled: true }
  );
}

export function useBackendSavedAlbums() {
  return useData<Album[]>(
    () => backendAPI.getBackendSavedAlbums(),
    { enabled: true }
  );
}

// ==================== SAVED TRACKS (LIKED SONGS) ====================

export function useSavedTracks() {
  return useData<Track[]>(
    () => spotifyAPI.getSavedTracks(),
    { enabled: true }
  );
}

export function useBackendSavedTracks() {
  return useData<Track[]>(
    () => backendAPI.getBackendSavedTracks(),
    { enabled: true }
  );
}

// ==================== FOLLOWED ARTISTS ====================

export function useFollowedArtists() {
  return useData<Artist[]>(
    () => spotifyAPI.getFollowedArtists(),
    { enabled: true }
  );
}

export function useBackendFollowedArtists() {
  return useData<Artist[]>(
    () => backendAPI.getBackendFollowedArtists(),
    { enabled: true }
  );
}

// ==================== BROWSE CATEGORIES ====================

export function useBrowseCategories() {
  return useData<BrowseCategory[]>(
    async () => {
      const categories = await spotifyAPI.getBrowseCategories();
      // Fetch playlists for each category
      const categoriesWithPlaylists = await Promise.all(
        categories.slice(0, 3).map(async (category) => {
          const playlists = await spotifyAPI.getCategoryPlaylists(category.id);
          return {
            ...category,
            playlists,
          };
        })
      );
      return categoriesWithPlaylists;
    },
    { enabled: true }
  );
}

export function useBackendBrowseCategories() {
  return useData<BrowseCategory[]>(
    () => backendAPI.getBackendBrowseCategories(),
    { enabled: true }
  );
}

// ==================== DASHBOARD DATA (ALL-IN-ONE) ====================

export interface DashboardData {
  recentlyPlayed: RecentlyPlayedItem[];
  featuredPlaylists: Playlist[];
  newReleases: Album[];
  madeForYou: Playlist[];
  topTracks: Track[];
  topArtists: Artist[];
  recommendations: Track[];
  savedAlbums: Album[];
  userPlaylists: Playlist[];
  browseCategories: BrowseCategory[];
  savedTracks: Track[];
  followedArtists: Artist[];
  isLoading: boolean;
  error: Error | null;
}

export function useDashboard(): DashboardData {
  const { data: recentlyPlayed = [], isLoading: loading1 } = useRecentlyPlayed(8);
  const { data: featuredPlaylists = [], isLoading: loading2 } = useFeaturedPlaylists(7);
  const { data: newReleases = [], isLoading: loading3 } = useNewReleases(7);
  const { data: madeForYou = [], isLoading: loading4 } = useMadeForYou();
  const { data: topTracks = [], isLoading: loading5 } = useBackendTopTracks();
  const { data: topArtists = [], isLoading: loading6 } = useBackendTopArtists();
  const { data: recommendations = [], isLoading: loading7 } = useRecommendations();
  const { data: savedAlbums = [], isLoading: loading8 } = useBackendSavedAlbums();
  const { data: userPlaylists = [], isLoading: loading9 } = useBackendPlaylists();
  const { data: browseCategories = [], isLoading: loading10 } = useBackendBrowseCategories();
  const { data: savedTracks = [], isLoading: loading11 } = useBackendSavedTracks();
  const { data: followedArtists = [], isLoading: loading12 } = useBackendFollowedArtists();

  return {
    recentlyPlayed: recentlyPlayed || [],
    featuredPlaylists: featuredPlaylists || [],
    newReleases: newReleases || [],
    madeForYou: madeForYou || [],
    topTracks: topTracks || [],
    topArtists: topArtists || [],
    recommendations: recommendations || [],
    savedAlbums: savedAlbums || [],
    userPlaylists: userPlaylists || [],
    browseCategories: browseCategories || [],
    savedTracks: savedTracks || [],
    followedArtists: followedArtists || [],
    isLoading: loading1 || loading2 || loading3 || loading4 || loading5 || loading6 || 
               loading7 || loading8 || loading9 || loading10 || loading11 || loading12,
    error: null,
  };
}
