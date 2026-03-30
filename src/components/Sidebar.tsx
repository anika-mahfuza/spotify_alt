import { useState, useEffect } from 'react';
import { Music, X, Plus, Trash2 } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ImportPlaylist } from './ImportPlaylist';
import { ImportedPlaylist } from '../types';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const [playlists, setPlaylists] = useState<ImportedPlaylist[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ImportedPlaylist | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    onClose?.();
  }, [location.pathname]);

  useEffect(() => {
    const saved = localStorage.getItem('imported_playlists');
    if (saved) {
      try { setPlaylists(JSON.parse(saved)); } catch { /* ignore */ }
    }

    const handleImported = () => {
      const saved = localStorage.getItem('imported_playlists');
      if (saved) {
        try { setPlaylists(JSON.parse(saved)); } catch { /* ignore */ }
      }
    };

    const handleDeleted = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const id = typeof detail === 'string' ? detail : detail?.id;
      if (id) {
        setPlaylists(prev => prev.filter(p => p.id !== id));
      }
    };

    window.addEventListener('playlist-imported', handleImported);
    window.addEventListener('playlist-deleted', handleDeleted);
    return () => {
      window.removeEventListener('playlist-imported', handleImported);
      window.removeEventListener('playlist-deleted', handleDeleted);
    };
  }, []);

  const handleImported = (playlist: ImportedPlaylist) => {
    setPlaylists(prev => [...prev, playlist]);
    setShowImport(false);
  };

  const handleDelete = () => {
    if (!confirmDelete) return;
    const id = confirmDelete.id;
    const updated = playlists.filter(p => p.id !== id);
    setPlaylists(updated);
    localStorage.setItem('imported_playlists', JSON.stringify(updated));
    setConfirmDelete(null);

    // Navigate away if viewing deleted playlist
    if (location.pathname === `/playlist/${id}`) {
      navigate('/');
    }

    // Dispatch event for other components
    window.dispatchEvent(new CustomEvent('playlist-deleted', { detail: { id } }));
  };

  return (
    <>
      {showImport && (
        <ImportPlaylist
          onClose={() => setShowImport(false)}
          onImported={handleImported}
        />
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[300] flex items-center justify-center p-4"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="bg-[#1a1a1a] rounded-2xl w-full max-w-sm border border-white/10 shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5">
              <h3 className="text-lg font-bold text-white mb-1">Delete playlist?</h3>
              <p className="text-sm text-white/60 mb-1">
                <span className="font-medium text-white">"{confirmDelete.name}"</span> will be removed from your library.
              </p>
              <p className="text-xs text-white/40 mb-5">This cannot be undone.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 py-2.5 rounded-full bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[190] md:hidden"
          onClick={onClose}
        />
      )}

      <div
        className={`flex flex-col z-[200] border-r border-white/10 transition-all duration-300 bg-transparent fixed inset-y-0 left-0 w-72 md:static md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ height: 'calc(100vh - 6rem)' }}
      >
        <div className="p-5 pb-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 bg-bg-secondary rounded-lg flex items-center justify-center">
              <Music size={20} className="text-primary" />
            </div>
            <span className="text-xl font-semibold text-white">Music</span>
          </Link>
          <button
            onClick={onClose}
            className="md:hidden p-1 hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={20} className="text-white" />
          </button>
        </div>

        <nav className="px-3 mb-4 space-y-1">
          <Link
            to="/"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-all ${location.pathname === '/' ? 'bg-white/10 text-white backdrop-blur-sm' : 'text-text-secondary hover:text-white hover:bg-white/5'}`}
          >
            <Music size={20} />
            <span className="font-medium text-sm">Home</span>
          </Link>
        </nav>

        <div className="px-5 pb-3 flex items-center justify-between">
          <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider">
            Imported Playlists
          </h2>
          <div className="flex items-center gap-2">
            {playlists.length > 0 && (
              <span className="text-xs text-text-muted bg-black/30 px-2 py-0.5 rounded-full">
                {playlists.length}
              </span>
            )}
            <button
              onClick={() => setShowImport(true)}
              className="p-1 rounded-full hover:bg-white/10 transition-colors text-text-muted hover:text-white"
              title="Import Playlist"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 scrollbar-thin">
          {playlists.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-black/30 flex items-center justify-center">
                <Music size={22} className="text-text-muted" />
              </div>
              <p className="text-text-muted text-sm">No playlists yet</p>
              <button
                onClick={() => setShowImport(true)}
                className="mt-3 px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-full text-xs font-medium transition-colors"
              >
                Import a playlist
              </button>
            </div>
          ) : (
            <div className="space-y-0.5">
              {playlists.map((playlist) => {
                const isActive = location.pathname === `/playlist/${playlist.id}`;
                return (
                  <div
                    key={playlist.id}
                    className={`flex items-center gap-3 p-2 rounded-md transition-all duration-150 group ${isActive ? 'bg-white/10 backdrop-blur-sm' : 'hover:bg-white/5'}`}
                  >
                    <Link
                      to={`/playlist/${playlist.id}`}
                      className="flex items-center gap-3 flex-1 min-w-0"
                    >
                      <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-bg-secondary shadow-card">
                        {playlist.image ? (
                          <img
                            src={playlist.image}
                            alt={playlist.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-bg-tertiary">
                            <Music size={16} className="text-text-muted" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className={`font-medium text-sm truncate ${isActive ? 'text-white' : 'text-text-primary group-hover:text-white'}`}>
                          {playlist.name}
                        </div>
                        <div className="text-xs text-text-muted truncate flex items-center gap-1.5">
                          <span>{playlist.tracks.length} songs</span>
                          {playlist.owner && (
                            <>
                              <span className="text-text-disabled">•</span>
                              <span className="truncate">{playlist.owner}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </Link>

                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setConfirmDelete(playlist);
                      }}
                      className="p-1.5 rounded-full hover:bg-red-500/20 transition-colors opacity-0 group-hover:opacity-100 text-white/40 hover:text-red-400"
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
