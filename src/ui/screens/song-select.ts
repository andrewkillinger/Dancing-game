import { GameState, GameScreen, SONGS, SongDefinition, DifficultyLevel } from '@/types';
import { btn, el, haptic } from '@/ui/components/button';

// ─── Song Select Screen ───────────────────────────────────────────────────────

export function createSongSelectScreen(
  state: GameState,
  navigate: (screen: GameScreen) => void
): HTMLElement {
  const root = el('div', {}, {
    position: 'absolute',
    inset: '0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    background: 'linear-gradient(160deg, rgba(26,5,51,0.95) 0%, rgba(45,10,94,0.98) 100%)',
    overflowY: 'auto',
  });

  // ── Header ─────────────────────────────────────────────────────────────────
  const header = el('div', {}, {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    maxWidth: '420px',
    padding: 'max(env(safe-area-inset-top,16px),16px) 16px 0',
    boxSizing: 'border-box',
    gap: '12px',
  });

  const backBtn = btn('← Back', () => {
    haptic('light');
    navigate('home');
  }, 'ghost');
  backBtn.style.cssText += 'padding: 10px 14px; min-height: 44px; flex-shrink: 0;';

  const titleEl = el('h2', { textContent: '🎵 Pick a Song' }, {
    flex: '1',
    fontSize: 'clamp(1.3rem, 5vw, 1.8rem)',
    fontWeight: '900',
    margin: '0',
    background: 'linear-gradient(90deg, #FFE66D, #FF6B6B)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  });

  header.append(backBtn, titleEl);

  // ── Song Cards ─────────────────────────────────────────────────────────────
  const cardList = el('div', {}, {
    width: '100%',
    maxWidth: '420px',
    padding: '16px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  });

  let selectedId = state.selectedSong.id;
  const cardEls: Map<string, HTMLElement> = new Map();

  function difficultyColor(d: DifficultyLevel): string {
    if (d === 'easy')   return '#6BCB77';
    if (d === 'hard')   return '#FF6B6B';
    return '#FFE66D';
  }

  function formatDuration(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function styleLabel(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function buildCard(song: SongDefinition): HTMLElement {
    const card = el('div', {}, {
      background: 'rgba(255,255,255,0.06)',
      border: '2px solid rgba(255,255,255,0.12)',
      borderRadius: '16px',
      padding: '16px',
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
      cursor: 'pointer',
      transition: 'border-color 0.15s, background 0.15s',
      userSelect: 'none',
      WebkitUserSelect: 'none',
    });

    const emojiEl = el('div', { textContent: song.emoji }, {
      fontSize: '44px',
      lineHeight: '1',
      flexShrink: '0',
      width: '52px',
      textAlign: 'center',
    });

    const info = el('div', {}, { flex: '1', minWidth: '0' });

    const nameEl = el('div', { textContent: song.name }, {
      fontWeight: '800',
      fontSize: '17px',
      marginBottom: '4px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    });

    const metaRow = el('div', {}, {
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
      flexWrap: 'wrap',
    });

    const bpmBadge = el('span', { textContent: `${song.bpm} BPM` }, {
      fontSize: '12px',
      color: 'rgba(255,255,255,0.55)',
      fontWeight: '600',
    });

    const diffBadge = el('span', { textContent: song.difficulty.toUpperCase() }, {
      fontSize: '11px',
      fontWeight: '700',
      color: difficultyColor(song.difficulty),
      background: `${difficultyColor(song.difficulty)}22`,
      borderRadius: '4px',
      padding: '1px 6px',
    });

    const styleBadge = el('span', { textContent: styleLabel(song.style) }, {
      fontSize: '12px',
      color: 'rgba(255,255,255,0.45)',
    });

    const durEl = el('span', { textContent: `⏱ ${formatDuration(song.durationSec)}` }, {
      fontSize: '12px',
      color: 'rgba(255,255,255,0.45)',
      marginLeft: 'auto',
    });

    metaRow.append(bpmBadge, diffBadge, styleBadge, durEl);
    info.append(nameEl, metaRow);
    card.append(emojiEl, info);

    card.addEventListener('pointerdown', () => {
      haptic('light');
      selectedId = song.id;
      updateSelectionStyles();
    });

    return card;
  }

  function updateSelectionStyles(): void {
    for (const [id, cardEl] of cardEls) {
      if (id === selectedId) {
        cardEl.style.borderColor = '#6C3FF5';
        cardEl.style.background = 'rgba(108,63,245,0.18)';
      } else {
        cardEl.style.borderColor = 'rgba(255,255,255,0.12)';
        cardEl.style.background = 'rgba(255,255,255,0.06)';
      }
    }
  }

  for (const song of SONGS) {
    const card = buildCard(song);
    cardEls.set(song.id, card);
    cardList.appendChild(card);
  }
  updateSelectionStyles();

  // ── Play Button ────────────────────────────────────────────────────────────
  const footer = el('div', {}, {
    width: '100%',
    maxWidth: '420px',
    padding: '8px 16px max(env(safe-area-inset-bottom,24px),24px)',
    boxSizing: 'border-box',
  });

  const playBtn = btn('▶️ Play!', () => {
    haptic('medium');
    const chosen = SONGS.find(s => s.id === selectedId) ?? SONGS[0];
    state.selectedSong = chosen;
    navigate('dance');
  }, 'primary');
  playBtn.style.cssText += 'width: 100%; font-size: 20px; padding: 18px; min-height: 60px;';

  footer.appendChild(playBtn);

  root.append(header, cardList, footer);

  return root;
}
