import { useState, useEffect } from 'react'

// ── Design tokens ─────────────────────────────────────────────────────────────
const colors = {
  bg: '#0d1117',
  surface: '#161b22',
  card: '#21262d',
  border: '#30363d',
  accent: '#f97316',        // warm amber-orange — classic radio feel
  accentDim: '#7c3d12',
  live: '#22c55e',
  text: '#e6edf3',
  muted: '#8b949e',
  subtle: '#484f58',
} as const

// ── Mock data ─────────────────────────────────────────────────────────────────
const station = {
  name: 'WKPR 91.3 FM',
  tagline: 'Public Radio for the Greater Valley',
  frequency: '91.3 FM',
  logo: '📻',
  streamUrl: '#',
}

const nowPlaying = {
  title: 'Morning Edition',
  host: 'Rachel Carmichael',
  description: 'The morning news magazine with in-depth reporting on the stories that matter.',
  startTime: '6:00 AM',
  endTime: '9:00 AM',
  coverColor: '#1d3a5f',
  listeners: 4312,
}

const currentTrack = {
  song: 'Gymnopédie No. 1',
  artist: 'Erik Satie',
  album: 'Trois Gymnopédies',
  duration: 195,  // seconds
  elapsed: 87,
}

const schedule = [
  { time: '6:00 AM',  title: 'Morning Edition',     host: 'Rachel Carmichael', live: true },
  { time: '9:00 AM',  title: 'The Takeaway',         host: 'Marcus Webb',       live: false },
  { time: '12:00 PM', title: 'Here & Now',           host: 'Priya Nair',        live: false },
  { time: '3:00 PM',  title: 'All Things Considered',host: 'David Huang',       live: false },
  { time: '7:00 PM',  title: 'Fresh Air',            host: 'Terri Strand',      live: false },
  { time: '10:00 PM', title: 'Classical After Dark', host: 'Sofia Lemaire',     live: false },
]

const recentTracks = [
  { song: 'Clair de Lune',         artist: 'Claude Debussy',     time: '7:42 AM' },
  { song: 'The Four Seasons: Spring', artist: 'Vivaldi',         time: '7:28 AM' },
  { song: 'Nocturne in E-flat',    artist: 'Frédéric Chopin',    time: '7:15 AM' },
  { song: 'Brandenburg Concerto No. 3', artist: 'J.S. Bach',     time: '7:02 AM' },
]

const chatMessages = [
  { user: 'LandmarkListener',  text: 'Good morning from the valley! ☀️', time: '7:50' },
  { user: 'JazzhandsMike',     text: 'Rachel\'s coverage on the housing bill was excellent', time: '7:51' },
  { user: 'PianoFan92',        text: 'Love the Satie piece this morning 🎹', time: '7:52' },
  { user: 'NewMember2024',     text: 'First time tuning in — already a fan!', time: '7:53' },
  { user: 'ValleyRegular',     text: 'Pledge drive coming up — make sure to support!', time: '7:54' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider"
      style={{ backgroundColor: colors.live + '22', color: colors.live, border: `1px solid ${colors.live}44` }}>
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: colors.live }} />
      Live
    </span>
  )
}

function WaveformBars({ playing }: { playing: boolean }) {
  return (
    <div className="flex items-end gap-0.5 h-5">
      {[4, 7, 5, 9, 6, 8, 4, 7, 5, 6].map((h, i) => (
        <div
          key={i}
          className="w-1 rounded-sm transition-all"
          style={{
            height: playing ? `${h * 2}px` : '4px',
            backgroundColor: colors.accent,
            opacity: playing ? 0.85 : 0.3,
            animationName: playing ? 'bounce' : 'none',
            animationDelay: `${i * 80}ms`,
            animationDuration: '0.6s',
            animationIterationCount: 'infinite',
            animationDirection: 'alternate',
          }}
        />
      ))}
    </div>
  )
}

function ProgressBar({ elapsed, duration }: { elapsed: number; duration: number }) {
  const pct = Math.min(100, (elapsed / duration) * 100)
  return (
    <div className="space-y-1">
      <div className="relative h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: colors.border }}>
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: colors.accent }}
        />
      </div>
      <div className="flex justify-between text-xs" style={{ color: colors.muted }}>
        <span>{formatTime(elapsed)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function RadioStation() {
  const [playing, setPlaying] = useState(true)
  const [volume, setVolume] = useState(78)
  const [elapsed, setElapsed] = useState(currentTrack.elapsed)
  const [chatInput, setChatInput] = useState('')
  const [messages, setMessages] = useState(chatMessages)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => {
      setElapsed(e => e >= currentTrack.duration ? 0 : e + 1)
    }, 1000)
    return () => clearInterval(id)
  }, [playing])

  const sendMessage = () => {
    if (!chatInput.trim()) return
    setMessages(prev => [
      ...prev,
      { user: 'You', text: chatInput.trim(), time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) }
    ])
    setChatInput('')
  }

  return (
    <div className="min-h-screen font-[system-ui,sans-serif] text-sm"
      style={{ backgroundColor: colors.bg, color: colors.text }}>

      {/* ── Top nav ── */}
      <header className="border-b px-6 py-3 flex items-center justify-between"
        style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{station.logo}</span>
          <div>
            <div className="font-bold text-base tracking-tight" style={{ color: colors.text }}>{station.name}</div>
            <div className="text-xs" style={{ color: colors.muted }}>{station.tagline}</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <LiveBadge />
          <span className="text-xs font-mono" style={{ color: colors.muted }}>
            {nowPlaying.listeners.toLocaleString()} listening
          </span>
          <button
            className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all hover:brightness-110"
            style={{ backgroundColor: colors.accent, color: '#fff' }}
          >
            Donate
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left column: Player + Schedule ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Now playing card */}
          <div className="rounded-2xl overflow-hidden border" style={{ borderColor: colors.border }}>
            {/* Programme header */}
            <div className="px-6 py-5 flex items-start gap-4"
              style={{ backgroundColor: nowPlaying.coverColor, background: `linear-gradient(135deg, ${nowPlaying.coverColor}, #0d1117)` }}>
              <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>🎙️</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <LiveBadge />
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    {nowPlaying.startTime} – {nowPlaying.endTime}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white leading-tight">{nowPlaying.title}</h2>
                <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  with {nowPlaying.host}
                </p>
              </div>
            </div>

            {/* Player controls */}
            <div className="px-6 py-5 space-y-4" style={{ backgroundColor: colors.card }}>
              {/* Current track */}
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                  style={{ backgroundColor: colors.accentDim }}>🎵</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate" style={{ color: colors.text }}>{currentTrack.song}</div>
                  <div className="text-xs truncate" style={{ color: colors.muted }}>
                    {currentTrack.artist} · {currentTrack.album}
                  </div>
                </div>
                <WaveformBars playing={playing} />
              </div>

              {/* Progress */}
              <ProgressBar elapsed={elapsed} duration={currentTrack.duration} />

              {/* Controls */}
              <div className="flex items-center gap-4">
                {/* Skip back */}
                <button className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-white/5"
                  style={{ color: colors.muted }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M3 2h1.5v5.3L12 2.4v11.2L4.5 8.7V14H3V2z"/>
                  </svg>
                </button>

                {/* Play/pause */}
                <button
                  onClick={() => setPlaying(p => !p)}
                  className="w-11 h-11 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                  style={{ backgroundColor: colors.accent }}>
                  {playing ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
                      <rect x="3" y="2" width="4" height="12" rx="1"/>
                      <rect x="9" y="2" width="4" height="12" rx="1"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
                      <path d="M4 2l10 6-10 6V2z"/>
                    </svg>
                  )}
                </button>

                {/* Skip forward */}
                <button className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-white/5"
                  style={{ color: colors.muted }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M13 2h-1.5v5.3L4 2.4v11.2l7.5-4.9V14H13V2z"/>
                  </svg>
                </button>

                <div className="flex-1" />

                {/* Volume */}
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"
                    style={{ color: colors.muted }}>
                    <path d="M2 5H5L8 2v10L5 9H2V5z"/>
                    <path d="M10 4a3 3 0 0 1 0 6"/>
                  </svg>
                  <input
                    type="range" min="0" max="100" value={volume}
                    onChange={e => setVolume(Number(e.target.value))}
                    className="w-20 h-1 rounded-full appearance-none cursor-pointer"
                    style={{ accentColor: colors.accent }}
                  />
                  <span className="text-xs w-7 text-right" style={{ color: colors.muted }}>{volume}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Programme schedule */}
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: colors.border, backgroundColor: colors.card }}>
            <div className="px-6 py-4 border-b" style={{ borderColor: colors.border }}>
              <h3 className="font-semibold" style={{ color: colors.text }}>Today's Schedule</h3>
            </div>
            <div className="divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
              {schedule.map((item, i) => (
                <div key={i}
                  className="flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-white/[0.02]"
                  style={{ borderColor: colors.border }}>
                  <div className="w-16 text-xs font-mono flex-shrink-0" style={{ color: item.live ? colors.accent : colors.muted }}>
                    {item.time}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium flex items-center gap-2" style={{ color: item.live ? colors.text : colors.muted }}>
                      {item.title}
                      {item.live && <LiveBadge />}
                    </div>
                    <div className="text-xs" style={{ color: colors.subtle }}>with {item.host}</div>
                  </div>
                  {item.live && (
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: colors.live }} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Recent tracks */}
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: colors.border, backgroundColor: colors.card }}>
            <div className="px-6 py-4 border-b" style={{ borderColor: colors.border }}>
              <h3 className="font-semibold" style={{ color: colors.text }}>Recently Played</h3>
            </div>
            <div className="divide-y">
              {recentTracks.map((t, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-3 hover:bg-white/[0.02] transition-colors"
                  style={{ borderColor: colors.border }}>
                  <div className="w-7 h-7 rounded flex items-center justify-center text-sm flex-shrink-0"
                    style={{ backgroundColor: colors.surface }}>♪</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate" style={{ color: colors.text }}>{t.song}</div>
                    <div className="text-xs truncate" style={{ color: colors.muted }}>{t.artist}</div>
                  </div>
                  <span className="text-xs flex-shrink-0" style={{ color: colors.subtle }}>{t.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right column: Station info + Chat ── */}
        <div className="space-y-6">

          {/* Station info */}
          <div className="rounded-2xl border p-5 space-y-4" style={{ borderColor: colors.border, backgroundColor: colors.card }}>
            <h3 className="font-semibold" style={{ color: colors.text }}>About the Station</h3>
            <p className="text-xs leading-relaxed" style={{ color: colors.muted }}>
              WKPR 91.3 FM is a member-supported public radio station serving the Greater Valley area since 1974.
              We bring you in-depth news, classical music, and local stories that matter.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Frequency', value: '91.3 FM' },
                { label: 'Est.', value: '1974' },
                { label: 'Format', value: 'Public Radio' },
                { label: 'Coverage', value: '80mi radius' },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl p-3" style={{ backgroundColor: colors.surface }}>
                  <div className="text-xs" style={{ color: colors.muted }}>{label}</div>
                  <div className="font-semibold mt-0.5" style={{ color: colors.text }}>{value}</div>
                </div>
              ))}
            </div>
            <button className="w-full py-2.5 rounded-xl text-xs font-semibold transition-all hover:brightness-110 flex items-center justify-center gap-1.5"
              style={{ backgroundColor: colors.accent + '22', color: colors.accent, border: `1px solid ${colors.accent}44` }}>
              ♥ Become a Member
            </button>
          </div>

          {/* Listener chat */}
          <div className="rounded-2xl border overflow-hidden flex flex-col" style={{ borderColor: colors.border, backgroundColor: colors.card, height: '360px' }}>
            <div className="px-5 py-3.5 border-b flex items-center justify-between"
              style={{ borderColor: colors.border }}>
              <h3 className="font-semibold" style={{ color: colors.text }}>Listener Chat</h3>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: colors.live + '22', color: colors.live }}>
                {messages.length + 128} online
              </span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.map((m, i) => (
                <div key={i} className="space-y-0.5">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs font-semibold" style={{ color: m.user === 'You' ? colors.accent : colors.text }}>
                      {m.user}
                    </span>
                    <span className="text-xs" style={{ color: colors.subtle }}>{m.time}</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: colors.muted }}>{m.text}</p>
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t flex gap-2" style={{ borderColor: colors.border }}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Say something…"
                className="flex-1 px-3 py-1.5 rounded-lg text-xs outline-none"
                style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, color: colors.text }}
              />
              <button
                onClick={sendMessage}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:brightness-110"
                style={{ backgroundColor: colors.accent, color: '#fff' }}>
                Send
              </button>
            </div>
          </div>

          {/* App download banner */}
          <div className="rounded-2xl border p-5 text-center space-y-3"
            style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
            <div className="text-2xl">📱</div>
            <div>
              <div className="font-semibold text-sm" style={{ color: colors.text }}>Take WKPR with you</div>
              <div className="text-xs mt-0.5" style={{ color: colors.muted }}>Stream live on the free WKPR app</div>
            </div>
            <div className="flex gap-2">
              {['App Store', 'Google Play'].map(store => (
                <button key={store} className="flex-1 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-white/5"
                  style={{ border: `1px solid ${colors.border}`, color: colors.muted }}>
                  {store}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
