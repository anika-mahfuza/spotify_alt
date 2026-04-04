import { useEffect } from 'react';
import { ArrowRight, Library, Lock, Music, Search, Sparkles, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { APP_HOME_ROUTE, LANDING_ROUTE } from '../routes';
import { applyAlbumTheme, DEFAULT_ALBUM_THEME } from '../utils/colorExtractor';

const receiptCards = [
  {
    icon: Lock,
    eyebrow: 'Restriction Receipt 01',
    title: 'Premium-only access, premium-only patience',
    body: 'The docs say build delightful music experiences. The runtime says your dev account should maybe upgrade its feelings first.',
  },
  {
    icon: Library,
    eyebrow: 'Restriction Receipt 02',
    title: 'Playlists still deserve a better afterlife',
    body: 'Brokeify imports the public playlist, keeps the album art mood, and refuses to let good taste die in a policy memo.',
  },
  {
    icon: Sparkles,
    eyebrow: 'Restriction Receipt 03',
    title: 'If we must be petty, we can at least be pretty',
    body: 'Glass panels, soft gradients, dramatic cover art, and exactly enough sarcasm to remain employable.',
  },
];

const statusRows = [
  ['Developer morale', 'Bruised, but art-directed'],
  ['Playlist imports', 'Operational and mildly vindictive'],
  ['Premium gate reaction', 'Noted, ignored, redesigned'],
  ['Overall product stance', 'Polite rebellion with blur effects'],
];

const comparisonRows = [
  ['Spotify fantasy', 'Build freely, experiment boldly, definitely read the nice docs.'],
  ['Developer reality', 'Discover the best endpoints after the paywall has already cleared its throat.'],
  ['Brokeify response', 'Import the playlist, keep the vibe, ship the workaround, make it look expensive.'],
];

export function LandingPage() {
  useEffect(() => {
    document.title = 'Brokeify | Built Out Of API Spite';
    applyAlbumTheme(DEFAULT_ALBUM_THEME);
  }, []);

  return (
    <div className="relative h-screen overflow-x-hidden overflow-y-auto bg-bg-base text-text-primary">
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(circle at 14% 16%, rgb(var(--accent-color-rgb) / 0.24), transparent 26%),
            radial-gradient(circle at 84% 18%, rgb(var(--surface-tint-rgb) / 0.22), transparent 24%),
            radial-gradient(circle at 50% 76%, rgb(var(--accent-color-rgb) / 0.12), transparent 32%),
            linear-gradient(180deg, rgb(var(--support-dark-rgb) / 0.94) 0%, rgb(var(--app-bg-rgb)) 100%)
          `,
        }}
      />
      <div className="pointer-events-none absolute left-[8%] top-28 h-48 w-48 rounded-full blur-3xl" style={{ background: 'rgb(var(--accent-color-rgb) / 0.22)' }} />
      <div className="pointer-events-none absolute bottom-16 right-[10%] h-64 w-64 rounded-full blur-3xl" style={{ background: 'rgb(var(--surface-tint-rgb) / 0.18)' }} />

      <div className="relative z-10">
        <header className="px-4 pt-4 md:px-6 md:pt-6">
          <div className="app-panel mx-auto flex max-w-6xl items-center justify-between rounded-full px-4 py-3 md:px-6">
            <Link to={LANDING_ROUTE} className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-[14px] app-card">
                <img src="/vite.png" alt="Brokeify logo" className="h-full w-full object-cover" />
              </div>
              <div>
                <span className="block text-sm font-semibold tracking-[0.08em] text-text-primary md:text-base">Brokeify</span>
                <span className="block text-[11px] uppercase tracking-[0.24em] text-text-muted">Premium denial, but curated</span>
              </div>
            </Link>

            <div className="flex items-center gap-3">
              <span className="hidden text-xs text-text-secondary md:block">Tasteful retaliation for premium-only API energy.</span>
              <Link to={APP_HOME_ROUTE} className="app-button-primary inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold">
                Open The App
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 pb-20 pt-8 md:px-6 md:pb-24 md:pt-14">
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:items-stretch">
            <div className="app-panel-strong animate-slide-up rounded-[32px] px-6 py-7 md:px-8 md:py-9">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-bg-primary/18 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-text-secondary">
                <Wallet size={14} className="text-primary" />
                Built after the premium gate closed
              </div>

              <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-[1.02] text-text-primary md:text-6xl">
                Spotify said non-premium developers should maybe want less.
                <span className="mt-2 block text-primary">Brokeify took that personally.</span>
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-7 text-text-secondary md:text-lg">
                This is the prettier, pettier fallback: import the playlist, keep the album-art atmosphere, and turn a premium-only API policy into an interface with actual taste.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link to={APP_HOME_ROUTE} className="app-button-primary inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold">
                  Enter The Import Bunker
                  <ArrowRight size={17} />
                </Link>
                <a href="#receipts" className="app-button-secondary inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold">
                  Read The Receipts
                  <Search size={16} />
                </a>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="app-card rounded-[20px] px-4 py-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-text-muted">Current status</p>
                  <p className="mt-2 text-lg font-semibold text-text-primary">Public playlist imports</p>
                  <p className="mt-1 text-sm text-text-secondary">Still standing. Mildly offended. Very functional.</p>
                </div>
                <div className="app-card rounded-[20px] px-4 py-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-text-muted">UI mood</p>
                  <p className="mt-2 text-lg font-semibold text-text-primary">Album-first glass chaos</p>
                  <p className="mt-1 text-sm text-text-secondary">Soft gradients, sharp edges, zero corporate forgiveness.</p>
                </div>
                <div className="app-card rounded-[20px] px-4 py-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-text-muted">Business model</p>
                  <p className="mt-2 text-lg font-semibold text-text-primary">Spite as a service</p>
                  <p className="mt-1 text-sm text-text-secondary">No premium gate, just design choices and a bruised ego.</p>
                </div>
              </div>
            </div>

            <div className="app-panel animate-scale-in relative overflow-hidden rounded-[32px] p-5 md:p-6">
              <div className="absolute inset-0 opacity-90" style={{ background: 'linear-gradient(180deg, rgb(var(--surface-tint-rgb) / 0.12), transparent 34%)' }} />
              <div className="relative z-10">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-text-muted">Policy Moodboard</p>
                    <h2 className="mt-2 text-2xl font-bold text-text-primary">Premium Access Review</h2>
                  </div>
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-[18px] app-card">
                    <img src="/vite.png" alt="Brokeify mark" className="h-full w-full object-cover" />
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  <div className="app-card rounded-[22px] px-4 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-text-primary">Spotify says</p>
                        <p className="mt-1 text-sm leading-6 text-text-secondary">Please enjoy this API responsibly, preferably with a premium account and lowered expectations.</p>
                      </div>
                      <div className="rounded-full border border-danger/40 bg-danger/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-danger">
                        Denied
                      </div>
                    </div>
                  </div>

                  <div className="app-card rounded-[22px] px-4 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-text-primary">Brokeify replies</p>
                        <p className="mt-1 text-sm leading-6 text-text-secondary">Fine. We will import the playlist anyway, keep the art direction, and make the rejection part of the aesthetic.</p>
                      </div>
                      <div className="rounded-full border border-primary/30 bg-primary/14 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                        Shipped
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-[24px] border border-border/40 bg-black/14 p-4">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">
                    <Music size={14} className="text-primary" />
                    Live Brokeify telemetry
                  </div>
                  <div className="mt-4 space-y-3">
                    {statusRows.map(([label, value]) => (
                      <div key={label} className="flex items-start justify-between gap-4 border-b border-border/20 pb-3 last:border-b-0 last:pb-0">
                        <span className="text-sm text-text-secondary">{label}</span>
                        <span className="max-w-[52%] text-right text-sm font-medium text-text-primary">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="receipts" className="pt-14 md:pt-20">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-text-muted">Receipts</p>
                <h2 className="mt-2 text-3xl font-bold text-text-primary md:text-4xl">A tasteful record of why this site had to exist.</h2>
              </div>
              <p className="hidden max-w-sm text-sm leading-6 text-text-secondary md:block">
                The landing page is calm. The premise is not. That balance feels correct.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {receiptCards.map(({ icon: Icon, eyebrow, title, body }) => (
                <div key={title} className="app-panel rounded-[28px] px-5 py-5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[16px] app-card">
                    <Icon size={20} className="text-primary" />
                  </div>
                  <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-text-muted">{eyebrow}</p>
                  <h3 className="mt-2 text-xl font-semibold leading-snug text-text-primary">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-text-secondary">{body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-4 pt-14 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] md:pt-20">
            <div className="app-panel rounded-[30px] px-6 py-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-text-muted">Expectation Management</p>
              <h2 className="mt-2 text-3xl font-bold text-text-primary">What the glossy platform fantasy promised.</h2>
              <div className="mt-6 space-y-3">
                <div className="app-card rounded-[20px] px-4 py-4">
                  <p className="text-sm font-semibold text-text-primary">Step 1</p>
                  <p className="mt-1 text-sm leading-6 text-text-secondary">Read API docs and feel briefly inspired by all the things a music app might become.</p>
                </div>
                <div className="app-card rounded-[20px] px-4 py-4">
                  <p className="text-sm font-semibold text-text-primary">Step 2</p>
                  <p className="mt-1 text-sm leading-6 text-text-secondary">Meet the premium-only wall and begin a private negotiation with your remaining optimism.</p>
                </div>
                <div className="app-card rounded-[20px] px-4 py-4">
                  <p className="text-sm font-semibold text-text-primary">Step 3</p>
                  <p className="mt-1 text-sm leading-6 text-text-secondary">Realize the most productive feature left is tasteful retaliation.</p>
                </div>
              </div>
            </div>

            <div className="app-panel-strong rounded-[30px] px-6 py-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-text-muted">Brokeify Resolution</p>
              <h2 className="mt-2 text-3xl font-bold text-text-primary">So the workaround became the product.</h2>
              <div className="mt-6 space-y-4">
                {comparisonRows.map(([label, body]) => (
                  <div key={label} className="rounded-[22px] border border-border/30 bg-bg-primary/14 px-4 py-4">
                    <p className="text-sm font-semibold text-text-primary">{label}</p>
                    <p className="mt-1 text-sm leading-6 text-text-secondary">{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="pt-14 md:pt-20">
            <div className="app-panel-strong relative overflow-hidden rounded-[34px] px-6 py-8 md:px-8 md:py-10">
              <div className="absolute inset-0 opacity-80" style={{ background: 'linear-gradient(135deg, rgb(var(--accent-color-rgb) / 0.16), transparent 44%)' }} />
              <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="max-w-2xl">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-text-muted">Final CTA</p>
                  <h2 className="mt-2 text-3xl font-bold text-text-primary md:text-4xl">Open the app. Import the playlist. Let the policy pettiness finance the atmosphere.</h2>
                  <p className="mt-3 text-sm leading-7 text-text-secondary md:text-base">
                    Brokeify exists because "premium required" is a terrible ending for a perfectly good side project.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link to={APP_HOME_ROUTE} className="app-button-primary inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold">
                    Launch /import
                    <ArrowRight size={17} />
                  </Link>
                  <a href="#receipts" className="app-button-secondary inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold">
                    Review The Evidence
                    <Search size={16} />
                  </a>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
