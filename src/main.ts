import '@/styles/global.css';
import { GameState, GameScreen, CustomizationData, DEFAULT_CUSTOMIZATION, DEFAULT_SONG } from '@/types';
import { createScoreState } from '@/game/scoring';
import { engine } from '@/game/engine';
import { soundSystem } from '@/game/sounds';
import { authService } from '@/services/supabase/auth';
import { createHomeScreen } from '@/ui/screens/home';
import { createCustomizeScreen } from '@/ui/screens/customize';
import { createDanceScreen } from '@/ui/screens/dance';
import { createLeaderboardScreen } from '@/ui/screens/leaderboard';
import { createLockerScreen } from '@/ui/screens/locker';
import { createSongSelectScreen } from '@/ui/screens/song-select';

// ─── Loading Progress ─────────────────────────────────────────────────────────

const loadingBar = document.getElementById('loading-bar') as HTMLDivElement;
const loadingScreen = document.getElementById('loading-screen') as HTMLDivElement;

function setLoadingProgress(pct: number): void {
  loadingBar.style.width = `${pct}%`;
}

function hideLoading(): void {
  loadingScreen.classList.add('hidden');
  setTimeout(() => loadingScreen.remove(), 600);
}

// ─── App State ────────────────────────────────────────────────────────────────

const initialState: GameState = {
  screen: 'home',
  profile: {
    id: `guest_${Date.now()}`,
    displayName: 'Wobbler',
    customization: { ...DEFAULT_CUSTOMIZATION },
    lastSeen: new Date().toISOString(),
    isGuest: true,
  },
  currentScore: createScoreState(),
  activeMove: 'idle',
  isPlaying: false,
  audioEnabled: true,
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  fps: 60,
  quality: 'high',
  selectedSong: DEFAULT_SONG,
};

// ─── Router ───────────────────────────────────────────────────────────────────

const uiLayer = document.getElementById('ui-layer') as HTMLDivElement;
const canvasContainer = document.getElementById('game-canvas-container') as HTMLDivElement;

let currentScreenEl: HTMLElement | null = null;
let danceCleanup: (() => void) | null = null;
// Use null so the first navigate('home') call is never short-circuited
let currentScreen: GameScreen | null = null;

async function navigate(screen: GameScreen): Promise<void> {
  if (currentScreen === screen) return;

  // Cleanup dance screen
  if (danceCleanup) {
    danceCleanup();
    danceCleanup = null;
  }

  // Remove current screen
  if (currentScreenEl) {
    currentScreenEl.remove();
    currentScreenEl = null;
  }

  currentScreen = screen as GameScreen;
  initialState.screen = screen;

  // Show/hide canvas
  const showCanvas = screen === 'dance';
  canvasContainer.style.visibility = showCanvas ? 'visible' : 'hidden';

  // Build new screen
  let el: HTMLElement;

  switch (screen) {
    case 'home':
      el = createHomeScreen(initialState, navigate);
      break;

    case 'customize':
      el = createCustomizeScreen(
        initialState,
        navigate,
        (cust: CustomizationData) => {
          initialState.profile.customization = cust;
        }
      );
      break;

    case 'dance': {
      const result = createDanceScreen(initialState, engine, navigate);
      el = result.element;
      danceCleanup = result.cleanup;
      initialState.isPlaying = true;
      break;
    }

    case 'leaderboard':
      el = createLeaderboardScreen(initialState, navigate);
      break;

    case 'locker':
      el = createLockerScreen(
        initialState,
        navigate,
        (cust: CustomizationData) => {
          initialState.profile.customization = cust;
        }
      );
      break;

    case 'song-select':
      el = createSongSelectScreen(initialState, navigate);
      break;

    default:
      el = createHomeScreen(initialState, navigate);
  }

  currentScreenEl = el;
  uiLayer.appendChild(el);

  // Animate in
  el.style.opacity = '0';
  requestAnimationFrame(() => {
    el.style.transition = 'opacity 0.25s ease';
    el.style.opacity = '1';
  });

  // Stop isPlaying flag when leaving dance
  if (screen !== 'dance') {
    initialState.isPlaying = false;
  }

  // (screen_change event omitted – no active subscribers in current build)
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  setLoadingProgress(10);

  // Init auth (always resolves – falls back to guest on any error)
  try {
    const profile = await authService.init();
    initialState.profile = profile;
  } catch (err) {
    console.warn('[App] Auth init failed, using guest mode:', err);
  }
  setLoadingProgress(35);

  // Init game engine
  let engineReady = false;
  try {
    await engine.init(canvasContainer, initialState);
    engineReady = true;
    setLoadingProgress(70);
  } catch (err) {
    console.error('[App] Engine init failed:', err);
    setLoadingProgress(70);
  }

  // Start engine loop only if engine initialized successfully
  if (engineReady) {
    engine.start();
  }
  setLoadingProgress(90);

  // Show home screen – canvas hidden on non-dance screens
  canvasContainer.style.visibility = 'hidden';
  await navigate('home');
  setLoadingProgress(100);

  // Hide loading screen
  setTimeout(hideLoading, 300);

  // Unlock audio on first user gesture (mobile autoplay policy)
  const unlockAudio = (): void => {
    if (initialState.audioEnabled) {
      soundSystem.init();
      soundSystem.setEnabled(true);
    }
    document.removeEventListener('touchstart', unlockAudio);
    document.removeEventListener('click', unlockAudio);
  };
  document.addEventListener('touchstart', unlockAudio, { passive: true });
  document.addEventListener('click', unlockAudio, { passive: true });

  // Handle orientation changes safely
  if (engineReady) {
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        engine.app.renderer.resize(window.innerWidth, window.innerHeight);
      }, 200);
    });
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────

init().catch(err => {
  console.error('[App] Fatal init error:', err);
  loadingBar.style.background = '#FF4444';
  const errMsg = document.createElement('p');
  errMsg.textContent = 'Failed to load. Please refresh.';
  errMsg.style.cssText = 'color:#fff;margin-top:16px;font-size:14px;';
  loadingScreen.appendChild(errMsg);
});
