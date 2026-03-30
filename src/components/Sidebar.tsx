import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Music, Plus, Trash2, X } from 'lucide-react';
import { ImportedPlaylist } from '../types';
import { ImportPlaylist } from './ImportPlaylist';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const [playlists, setPlaylists] = useState<ImportedPlaylist[]>(() => {
    const saved = localStorage.getItem('imported_playlists');
    if (!saved) return [];

    try {
      return JSON.parse(saved);
    } catch {
      return [];
    }
  });
  const [showImport, setShowImport] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ImportedPlaylist | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const previousPathRef = useRef(location.pathname);

  useEffect(() => {
    if (location.pathname !== previousPathRef.current) {
      previousPathRef.current = location.pathname;
      onClose?.();
    }
  }, [location.pathname, onClose]);

  useEffect(() => {
    const handleImported = () => {
      const latest = localStorage.getItem('imported_playlists');
      if (latest) {
        try {
          setPlaylists(JSON.parse(latest));
        } catch {
          // Ignore malformed local state.
        }
      }
    };

    const handleDeleted = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const id = typeof detail === 'string' ? detail : detail?.id;
      if (id) {
        setPlaylists(prev => prev.filter(playlist => playlist.id !== id));
      }
    };

    window.addEventListener('playlist-imported', handleImported);
    window.addEventListener('playlist-deleted', handleDeleted);

    return () => {
      window.removeEventListener('playlist-imported', handleImported);
      window.removeEventListener('playlist-deleted', handleDeleted);
    };
  }, []);

  const handleImported = () => {
    setShowImport(false);
  };

  const handleDelete = () => {
    if (!confirmDelete) return;

    const id = confirmDelete.id;
    const updated = playlists.filter(playlist => playlist.id !== id);
    setPlaylists(updated);
    localStorage.setItem('imported_playlists', JSON.stringify(updated));
    setConfirmDelete(null);

    if (location.pathname === `/playlist/${id}`) {
      navigate('/');
    }

    window.dispatchEvent(new CustomEvent('playlist-deleted', { detail: { id } }));
  };

  return (
    <>
      {showImport ? (
        <ImportPlaylist onClose={() => setShowImport(false)} onImported={handleImported} />
      ) : null}

      {confirmDelete ? (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="app-panel-strong w-full max-w-sm overflow-hidden rounded-[28px]"
            onClick={event => event.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-lg font-bold text-text-primary">Delete playlist?</h3>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                <span className="font-medium text-text-primary">"{confirmDelete.name}"</span> will be removed from your library.
              </p>
              <p className="mt-1 text-xs text-text-muted">This action cannot be undone.</p>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="app-button-secondary flex-1 rounded-full px-4 py-2.5 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 rounded-full border border-danger/40 bg-danger/85 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-danger"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isOpen ? (
        <div className="fixed inset-0 z-[250] bg-black/55 md:hidden" onClick={onClose} />
      ) : null}

      <div
        className={`fixed inset-y-0 left-0 z-[260] flex w-72 flex-col border-r border-border/60 bg-bg-primary/46 shadow-[0_20px_50px_rgba(0,0,0,0.18)] backdrop-blur-3xl transition-transform duration-300 md:static md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ height: 'calc(100vh - 6rem)' }}
      >
        <div className="flex items-center justify-between px-4 pb-3 pt-4">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-[12px] app-card">
              <Music size={18} className="text-primary" />
            </div>
            <div>
              <span className="block text-base font-semibold text-text-primary">Music</span>
              <span className="block text-xs text-text-muted">Album-driven library</span>
            </div>
          </Link>

          <button
            onClick={onClose}
            className="app-icon-button flex h-9 w-9 items-center justify-center rounded-full md:hidden"
          >
            <X size={18} className="text-text-primary" />
          </button>
        </div>

        <nav className="px-3 pb-3">
          <Link
            to="/"
            className={`flex items-center gap-3 rounded-[14px] border border-transparent px-3.5 py-2.5 outline-none ring-0 focus:outline-none focus-visible:outline-none active:outline-none ${location.pathname === '/' ? 'app-card-active text-text-primary shadow-[0_18px_40px_rgba(0,0,0,0.22)]' : 'bg-transparent text-text-secondary shadow-none hover:text-text-primary'}`}
            onPointerUp={(event) => event.currentTarget.blur()}
            onTouchEnd={(event) => event.currentTarget.blur()}
          >
            <Music size={17} />
            <span className="text-sm font-medium">Home</span>
          </Link>
        </nav>

        <div className="flex items-center justify-between px-4 pb-3">
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.24em] text-text-muted">Imported playlists</h2>
            <p className="mt-1 text-xs text-text-secondary">{playlists.length} available</p>
          </div>

          <button
            onClick={() => setShowImport(true)}
            className="app-icon-button flex h-9 w-9 items-center justify-center rounded-full"
            title="Import Playlist"
          >
            <Plus size={16} className="text-text-primary" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {playlists.length === 0 ? (
            <div className="app-panel rounded-[16px] px-4 py-7 text-center">
              <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full app-card">
                <Music size={20} className="text-text-muted" />
              </div>
              <p className="text-sm text-text-secondary">No playlists yet</p>
              <button
                onClick={() => setShowImport(true)}
                className="app-button-secondary mt-4 rounded-full px-4 py-2 text-xs font-medium"
              >
                Import a playlist
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {playlists.map(playlist => {
                const isActive = location.pathname === `/playlist/${playlist.id}`;

                return (
                  <div
                    key={playlist.id}
                    className={`group flex items-center gap-2.5 rounded-[14px] border border-transparent p-1.5 ${isActive ? 'app-card-active shadow-[0_18px_40px_rgba(0,0,0,0.22)]' : 'bg-transparent shadow-none'}`}
                  >
                    <Link
                      to={`/playlist/${playlist.id}`}
                      className={`flex min-w-0 flex-1 items-center gap-3 rounded-[12px] px-1 py-0.5 outline-none ring-0 focus:outline-none focus-visible:outline-none active:outline-none ${isActive ? 'text-text-primary' : 'text-text-primary hover:text-text-primary'}`}
                      onPointerUp={(event) => event.currentTarget.blur()}
                      onTouchEnd={(event) => event.currentTarget.blur()}
                    >
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-[10px] bg-bg-secondary shadow-card">
                        {playlist.image ? (
                          <img
                            src={playlist.image}
                            alt={playlist.name}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-bg-secondary">
                            <Music size={16} className="text-text-muted" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium text-text-primary">
                          {playlist.name}
                        </div>
                        <div className={`truncate text-[11px] ${isActive ? 'text-text-secondary' : 'text-text-muted'}`}>
                          {playlist.tracks.length} songs{playlist.owner ? ` - ${playlist.owner}` : ''}
                        </div>
                      </div>
                    </Link>

                    <button
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setConfirmDelete(playlist);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted opacity-70 transition-all hover:bg-danger/12 hover:text-danger md:opacity-0 md:group-hover:opacity-100"
                      title="Delete playlist"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
