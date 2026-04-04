export const LANDING_ROUTE = '/home';
export const APP_HOME_ROUTE = '/import';
export const APP_PLAYLIST_ROUTE = '/import/playlist/:id';

const LEGACY_PLAYLIST_PREFIX = '/playlist/';
const APP_PLAYLIST_PREFIX = `${APP_HOME_ROUTE}/playlist/`;

export function buildAppPlaylistRoute(playlistId: string): string {
  return `${APP_PLAYLIST_PREFIX}${playlistId}`;
}

export function normalizeAppPath(path?: string | null): string | null {
  if (!path) return null;

  if (path === `${APP_HOME_ROUTE}/`) {
    return APP_HOME_ROUTE;
  }

  if (path === APP_HOME_ROUTE || path.startsWith(`${APP_HOME_ROUTE}/`)) {
    return path;
  }

  if (path.startsWith(LEGACY_PLAYLIST_PREFIX)) {
    const playlistId = path.slice(LEGACY_PLAYLIST_PREFIX.length);
    return playlistId ? buildAppPlaylistRoute(playlistId) : APP_HOME_ROUTE;
  }

  return null;
}
