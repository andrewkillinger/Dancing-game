import '@/styles/global.css';
import { GameState, GameScreen, CustomizationData, DEFAULT_CUSTOMIZATION } from '@/types';
import { createScoreState } from '@/game/scoring';
import { engine, eventBus } from '@/game/engine';
import { soundSystem } from '@/game/sounds';
import { authService } from '@/services/supabase/auth';
import { createHomeScreen } from '@/ui/screens/home';
import { createCustomizeScreen } from '@/ui/screens/customize';
import { createDanceScreen } from '@/ui/screens/dance';
import { createLeaderboardScreen } from '@/ui/screens/leaderboard';
import { createLockerScreen } from '@/ui/screens/locker';

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
  audioEnabled: false,
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  fps: 60,
  quality: 'high',
};

// ─── Router ───────────────────────────────────────────────────────────────────

const uiLayer = document.getElementById('ui-layer') as HTMLDivElement;
const canvasContainer = document.getElementById('game-canvas-container') as HTMLDivElement;

let currentScreenEl: HTMLElement | null = null;
let danceCleanup: (() => void) | null = null;
let currentScreen: GameScreen = 'home';

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

  currentScreen = screen;
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

  eventBus.emit('screen_change', { screen });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  setLoadingProgress(10);

  // Init auth
  try {
    const profile = await authService.init();
    initialState.profile = profile;
    setLoadingProgress(35);
  } catch (err) {
    console.warn('[App] Auth init failed, using guest mode:', err);
    setLoadingProgress(35);
  }

  // Init game engine
  try {
    await engine.init(canvasContainer, initialState);
    setLoadingProgress(70);
  } catch (err) {
    console.error('[App] Engine init failed:', err);
  }

  // Start engine loop
  engine.start();
  setLoadingProgress(90);

  // Show home screen
  canvasContainer.style.visibility = 'hidden';
  await navigate('home');
  setLoadingProgress(100);

  // Hide loading
  setTimeout(hideLoading, 300);

  // Audio: unlock on first interaction
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

  // Handle orientation changes
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      engine.app.renderer.resize(w, h);
    }, 200);
  });
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
