import { GameState, GameScreen, ScoreEntry } from '@/types';
import { btn, el, formatScore } from '@/ui/components/button';
import { dataService } from '@/services/supabase/data';

export function createLeaderboardScreen(
  state: GameState,
  navigate: (screen: GameScreen) => void
): HTMLElement {
  const root = el('div', {}, {
    position: 'absolute',
    inset: '0',
    display: 'flex',
    flexDirection: 'column',
    background: 'linear-gradient(160deg, #1a0533, #2d0a5e)',
    overflow: 'hidden',
  });

  // Top bar
  const topBar = el('div', {}, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'max(env(safe-area-inset-top,16px),16px) 20px 12px',
    flexShrink: '0',
  });

  const backBtn = btn('← Back', () => navigate('home'), 'ghost');
  backBtn.style.padding = '10px 16px';

  const titleEl = el('h2', { textContent: '🏆 Leaderboard' }, {
    fontSize: '20px', fontWeight: '800', margin: '0',
  });

  topBar.append(backBtn, titleEl, el('div', {}, { width: '80px' }));

  // Personal best
  const personalBest = el('div', {}, {
    margin: '0 16px 16px',
    padding: '14px 18px',
    background: 'rgba(108,63,245,0.2)',
    border: '1px solid rgba(108,63,245,0.4)',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexShrink: '0',
  });

  const pbIcon = el('span', { textContent: '⭐' }, { fontSize: '28px' });
  const pbInfo = el('div', {}, { flex: '1' });
  const pbTitle = el('div', { textContent: 'Your Best' }, {
    fontSize: '12px', fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: '1px', color: 'rgba(255,255,255,0.5)',
  });
  const pbScore = el('div', { textContent: '—' }, {
    fontSize: '24px', fontWeight: '900',
    background: 'linear-gradient(90deg, #FFE66D, #FF6B6B)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
  });
  pbInfo.append(pbTitle, pbScore);
  personalBest.append(pbIcon, pbInfo);

  dataService.getUserBestScore(state.profile.id).then(best => {
    pbScore.textContent = best > 0 ? `${formatScore(best)} Hype` : 'No scores yet';
  });

  // Loading spinner
  const loadingEl = el('div', { textContent: 'Loading scores...' }, {
    textAlign: 'center',
    padding: '40px',
    color: 'rgba(255,255,255,0.4)',
    fontSize: '15px',
  });

  // Scores list
  const scoresList = el('div', {}, {
    flex: '1',
    overflowY: 'auto',
    padding: '0 16px',
    paddingBottom: 'max(env(safe-area-inset-bottom,16px),16px)',
  });

  scoresList.appendChild(loadingEl);

  root.append(topBar, personalBest, scoresList);

  // Load leaderboard
  dataService.getLeaderboard(20).then(entries => {
    scoresList.removeChild(loadingEl);

    if (entries.length === 0) {
      scoresList.appendChild(el('div', {
        textContent: 'No scores yet! Be the first to play.',
      }, {
        textAlign: 'center',
        padding: '40px 16px',
        color: 'rgba(255,255,255,0.4)',
        fontSize: '15px',
      }));
      return;
    }

    const medals = ['🥇', '🥈', '🥉'];

    entries.forEach((entry, idx) => {
      const row = createScoreRow(entry, idx, medals[idx] ?? `${idx + 1}`);
      scoresList.appendChild(row);
    });
  });

  return root;
}

function createScoreRow(entry: ScoreEntry, idx: number, medal: string): HTMLElement {
  const row = el('div', {}, {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 14px',
    marginBottom: '8px',
    background: idx < 3 ? 'rgba(255,215,0,0.08)' : 'rgba(255,255,255,0.05)',
    borderRadius: '14px',
    border: idx < 3 ? '1px solid rgba(255,215,0,0.2)' : '1px solid rgba(255,255,255,0.08)',
  });

  const rankEl = el('div', { textContent: medal }, {
    fontSize: idx < 3 ? '22px' : '16px',
    fontWeight: '700',
    minWidth: '32px',
    textAlign: 'center',
    color: idx >= 3 ? 'rgba(255,255,255,0.4)' : '',
  });

  const nameEl = el('div', { textContent: entry.displayName ?? 'Wobbler' }, {
    flex: '1',
    fontWeight: '700',
    fontSize: '15px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  });

  const scoreEl = el('div', { textContent: `${formatScore(entry.score)} Hype` }, {
    fontWeight: '900',
    fontSize: '16px',
    background: 'linear-gradient(90deg, #FFE66D, #FF6B6B)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    whiteSpace: 'nowrap',
  });

  row.append(rankEl, nameEl, scoreEl);
  return row;
}
