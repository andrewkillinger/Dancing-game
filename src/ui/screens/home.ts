import { GameState, GameScreen } from '@/types';
import { btn, el, formatScore } from '@/ui/components/button';
import { haptic } from '@/ui/components/button';
import { authService } from '@/services/supabase/auth';
import { dataService } from '@/services/supabase/data';

export function createHomeScreen(
  state: GameState,
  navigate: (screen: GameScreen) => void
): HTMLElement {
  const root = el('div', {}, {
    position: 'absolute',
    inset: '0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'linear-gradient(160deg, rgba(26,5,51,0.85) 0%, rgba(45,10,94,0.92) 100%)',
    padding: '0',
    overflowY: 'auto',
  });

  // ── Header ──────────────────────────────────────────────────────────────────
  const header = el('div', {}, {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: 'max(env(safe-area-inset-top), 32px)',
    paddingBottom: '16px',
    width: '100%',
  });

  const logo = el('div', { textContent: '🕺' }, {
    fontSize: '64px',
    lineHeight: '1',
    animation: 'bounce 0.9s infinite alternate ease-in-out',
    marginBottom: '8px',
  });

  const title = el('h1', { textContent: 'Wobble Dance' }, {
    fontSize: 'clamp(2rem, 8vw, 3.5rem)',
    fontWeight: '900',
    letterSpacing: '-1px',
    background: 'linear-gradient(90deg, #FF6B6B, #FFE66D, #6BCB77, #4D96FF)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    margin: '0',
  });

  const tagline = el('p', { textContent: 'Drop stuff. Dance hard. Wobble on! 💃' }, {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '15px',
    marginTop: '6px',
    textAlign: 'center',
  });

  header.append(logo, title, tagline);

  // ── Profile Card ────────────────────────────────────────────────────────────
  const profileCard = el('div', {}, {
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '20px',
    padding: '14px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    width: 'calc(100% - 48px)',
    maxWidth: '380px',
    boxSizing: 'border-box',
  });

  const avatar = el('div', { textContent: '🕺' }, {
    fontSize: '36px',
    width: '52px',
    height: '52px',
    borderRadius: '50%',
    background: 'rgba(108,63,245,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: '0',
  });

  const profileInfo = el('div', {}, { flex: '1', minWidth: '0' });
  const profileName = el('div', {
    textContent: state.profile.displayName,
  }, {
    fontWeight: '700',
    fontSize: '17px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  });

  const guestBadge = el('div', {
    textContent: state.profile.isGuest ? '👤 Guest' : '⭐ Signed in',
  }, {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.5)',
    marginTop: '2px',
  });

  const bestScoreEl = el('div', { textContent: 'Best: —' }, {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.45)',
    marginTop: '2px',
  });

  profileInfo.append(profileName, guestBadge, bestScoreEl);
  profileCard.append(avatar, profileInfo);

  // Load best score async
  if (state.profile.id) {
    dataService.getUserBestScore(state.profile.id).then(best => {
      bestScoreEl.textContent = best > 0 ? `Best: ${formatScore(best)} Hype` : 'No scores yet';
    });
  }

  // ── Main Buttons ────────────────────────────────────────────────────────────
  const buttonGrid = el('div', {}, {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    width: 'calc(100% - 48px)',
    maxWidth: '380px',
    boxSizing: 'border-box',
  });

  const playBtn = btn('▶️ Play!', () => {
    haptic('medium');
    navigate('dance');
  }, 'primary');
  playBtn.style.cssText += 'grid-column: 1 / -1; font-size: 22px; padding: 18px; min-height: 64px;';

  const customizeBtn = btn('👗 Customize', () => {
    haptic('light');
    navigate('customize');
  }, 'secondary');

  const lockerBtn = btn('🗄️ My Locker', () => {
    haptic('light');
    navigate('locker');
  }, 'secondary');

  const lbBtn = btn('🏆 Leaderboard', () => {
    haptic('light');
    navigate('leaderboard');
  }, 'secondary');
  lbBtn.style.cssText += 'grid-column: 1 / -1;';

  buttonGrid.append(playBtn, customizeBtn, lockerBtn, lbBtn);

  // ── Settings Row ────────────────────────────────────────────────────────────
  const settingsRow = el('div', {}, {
    display: 'flex',
    gap: '12px',
    width: 'calc(100% - 48px)',
    maxWidth: '380px',
    paddingBottom: 'max(env(safe-area-inset-bottom), 24px)',
    boxSizing: 'border-box',
    justifyContent: 'center',
  });

  const audioBtn = btn(
    state.audioEnabled ? '🔊 Sound On' : '🔇 Sound Off',
    () => {
      state.audioEnabled = !state.audioEnabled;
      audioBtn.innerHTML = state.audioEnabled ? '🔊 Sound On' : '🔇 Sound Off';
    },
    'ghost'
  );
  audioBtn.style.cssText += 'flex: 1; font-size: 14px; padding: 10px;';

  const motionBtn = btn(
    state.reducedMotion ? '🐢 Less Motion' : '🌀 Full Motion',
    () => {
      state.reducedMotion = !state.reducedMotion;
      motionBtn.innerHTML = state.reducedMotion ? '🐢 Less Motion' : '🌀 Full Motion';
    },
    'ghost'
  );
  motionBtn.style.cssText += 'flex: 1; font-size: 14px; padding: 10px;';

  settingsRow.append(audioBtn, motionBtn);

  // ── Assemble ────────────────────────────────────────────────────────────────
  root.append(header, profileCard, buttonGrid, settingsRow);

  // Inject bounce keyframe if not already present
  if (!document.getElementById('home-bounce-style')) {
    const style = document.createElement('style');
    style.id = 'home-bounce-style';
    style.textContent = `
      @keyframes bounce {
        from { transform: translateY(0); }
        to { transform: translateY(-14px); }
      }
    `;
    document.head.appendChild(style);
  }

  // Subscribe to profile changes
  const unsubProfile = () => {
    const p = authService.profile;
    if (p) {
      profileName.textContent = p.displayName;
      guestBadge.textContent = p.isGuest ? '👤 Guest' : '⭐ Signed in';
    }
  };
  // Call once immediately
  unsubProfile();

  return root;
}
