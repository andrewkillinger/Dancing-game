import * as PIXI from 'pixi.js';
import { GameState, GameScreen } from '@/types';
import { btn, haptic, el, formatScore } from '@/ui/components/button';
import { GameEngine } from '@/game/engine';
import { Character } from '@/game/character';
import { RhythmEngine } from '@/game/rhythm';
import { CrowdManager } from '@/game/crowd';
import {
  createScoreState,
  tickScore,
  registerRhythmHit,
  calculateSessionBonus,
  generateDailyChallenge,
  getTodayDateStr,
  createChallengeProgress,
  updateChallengeProgress,
  ChallengeProgress,
  RhythmHitResult,
} from '@/game/scoring';
import { soundSystem } from '@/game/sounds';
import { dataService } from '@/services/supabase/data';

// ─── Grade helpers ────────────────────────────────────────────────────────────

function computeGrade(accuracy: number): string {
  if (accuracy >= 0.95) return 'S';
  if (accuracy >= 0.85) return 'A';
  if (accuracy >= 0.70) return 'B';
  if (accuracy >= 0.50) return 'C';
  return 'D';
}

function gradeColor(grade: string): string {
  switch (grade) {
    case 'S': return '#FFE66D';
    case 'A': return '#6BCB77';
    case 'B': return '#4D96FF';
    case 'C': return '#FFA94D';
    default:  return '#FF6B6B';
  }
}

// ─── Dance Screen ─────────────────────────────────────────────────────────────

export function createDanceScreen(
  state: GameState,
  gameEngine: GameEngine,
  navigate: (screen: GameScreen) => void
): { element: HTMLElement; cleanup: () => void } {
  const cleanup: Array<() => void> = [];

  // ── Root overlay (UI only, transparent for canvas) ─────────────────────────
  const root = el('div', {}, {
    position: 'absolute',
    inset: '0',
    display: 'flex',
    flexDirection: 'column',
    pointerEvents: 'none',
  });

  // ── Game setup ─────────────────────────────────────────────────────────────
  const { app } = gameEngine;
  const W = gameEngine.width;
  const H = gameEngine.height;

  // Song
  const song = state.selectedSong;
  const BPM = song.bpm;

  // Stage layers
  const bgLayer = new PIXI.Container();
  const crowdLayer = new PIXI.Container();
  const characterLayer = new PIXI.Container();
  const rhythmLayer = new PIXI.Container();
  const fxLayer = new PIXI.Container();

  app.stage.addChild(bgLayer);
  app.stage.addChild(crowdLayer);
  app.stage.addChild(characterLayer);
  app.stage.addChild(rhythmLayer);
  app.stage.addChild(fxLayer);

  // Background
  const bgGfx = new PIXI.Graphics();
  drawBackground(bgGfx, W, H);
  bgLayer.addChild(bgGfx);

  // Character
  const character = new Character(state.profile.customization);
  const charX = W / 2;
  const charY = H * 0.55;
  character.container.position.set(charX, charY);
  characterLayer.addChild(character.container);

  // Rhythm engine — uses song's beat pattern
  const rhythmEngine = new RhythmEngine(rhythmLayer, W, H, BPM, song.beatPattern);

  // Crowd manager
  const crowdMgr = new CrowdManager(crowdLayer, W, H);

  // Round-end tracking
  const TOTAL_BEATS = song.barCount * song.beatPattern.length;
  let beatsScheduled = 0;
  let roundEndTriggered = false;
  let roundEndTimerId: ReturnType<typeof setTimeout> | null = null;
  let peakCombo = 1.0;

  // Score state
  state.currentScore = createScoreState();
  const scoreState = state.currentScore;

  // Daily challenge
  const today = getTodayDateStr();
  const challenge = generateDailyChallenge(today);
  let challengeProgress: ChallengeProgress | null = null;
  let challengeRewarded = false;

  dataService.getChallengeCompletion(state.profile.id, today).then(done => {
    if (!done) {
      challengeProgress = createChallengeProgress(challenge);
    }
    updateChallengeUI();
  });

  // ── Score HUD ──────────────────────────────────────────────────────────────
  const hud = el('div', {}, {
    pointerEvents: 'none',
    padding: 'max(env(safe-area-inset-top,8px),8px) 16px 0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  });

  const scoreEl = el('div', {}, { textAlign: 'center' });
  const scoreNum = el('div', { textContent: '0' }, {
    fontSize: 'clamp(2rem, 8vw, 3rem)',
    fontWeight: '900',
    background: 'linear-gradient(90deg, #FFE66D, #FF6B6B)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    lineHeight: '1',
  });
  const scoreLabel = el('div', { textContent: 'HYPE' }, {
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '2px',
    color: 'rgba(255,255,255,0.45)',
  });
  scoreEl.append(scoreNum, scoreLabel);

  const comboEl = el('div', {}, { textAlign: 'center', minWidth: '80px' });
  const comboNum = el('div', { textContent: 'x1.0' }, {
    fontSize: '22px',
    fontWeight: '900',
    color: '#6BCB77',
  });
  const comboLabel = el('div', { textContent: 'COMBO' }, {
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '2px',
    color: 'rgba(255,255,255,0.45)',
  });
  comboEl.append(comboNum, comboLabel);

  const exitBtn = btn('✕', () => {
    haptic('light');
    finishSession();
    navigate('home');
  }, 'ghost');
  exitBtn.style.cssText += 'padding: 10px; min-height: 44px; pointer-events: auto;';
  exitBtn.setAttribute('aria-label', 'Exit to home');

  hud.append(scoreEl, comboEl, exitBtn);
  hud.style.pointerEvents = 'auto';

  // ── Challenge bar ──────────────────────────────────────────────────────────
  const challengeBar = el('div', {}, {
    margin: '8px 16px',
    padding: '10px 14px',
    background: 'rgba(255,255,255,0.08)',
    borderRadius: '12px',
    fontSize: '13px',
    color: 'rgba(255,255,255,0.75)',
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    pointerEvents: 'none',
  });
  const challengeIcon = el('span', { textContent: '🎯' }, { flexShrink: '0' });
  const challengeText = el('span', { textContent: challenge.description }, { flex: '1' });
  challengeBar.append(challengeIcon, challengeText);

  function updateChallengeUI(): void {
    if (!challengeProgress) {
      challengeText.textContent = '✅ Daily challenge already completed!';
      challengeIcon.textContent = '🏆';
      return;
    }
    const cond = challenge.conditions[0];
    if (cond.type === 'hit_streak') {
      const done = challengeProgress.bestStreak;
      const total = cond.count ?? 1;
      challengeText.textContent = `${challenge.description} (Best: ${done}/${total})`;
    }
    if (challengeProgress.completed && !challengeRewarded) {
      challengeRewarded = true;
      challengeText.textContent = '🎉 Challenge Complete! Bonus: ' + challenge.rewardPoints + ' Hype!';
      challengeIcon.textContent = '🏆';
      scoreState.crowdHype += challenge.rewardPoints;
      scoreState.totalScore = Math.floor(scoreState.crowdHype);
      soundSystem.playChallengeComplete();
      haptic('heavy');
    } else if (challengeProgress.completed) {
      challengeText.textContent = '🎉 Challenge Complete! Bonus: ' + challenge.rewardPoints + ' Hype!';
      challengeIcon.textContent = '🏆';
    }
  }

  // ── Energy bar ─────────────────────────────────────────────────────────────
  const energyBarFill = el('div', {}, {
    height: '100%',
    background: 'linear-gradient(90deg, #6BCB77, #FFE66D, #FF6B6B)',
    borderRadius: '2px',
    width: '0%',
    transition: 'width 0.2s ease-out',
  });
  const energyBarContainer = el('div', {}, {
    margin: '0 16px',
    height: '4px',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '2px',
    overflow: 'hidden',
    pointerEvents: 'none',
  });
  energyBarContainer.appendChild(energyBarFill);

  // ── Tap hint ───────────────────────────────────────────────────────────────
  const tapHint = el('div', { textContent: '🎵 Tap to dance — match the beat!' }, {
    textAlign: 'center',
    fontSize: '13px',
    color: 'rgba(255,255,255,0.45)',
    padding: '6px 16px',
    paddingBottom: 'max(env(safe-area-inset-bottom,10px),10px)',
    pointerEvents: 'none',
  });

  root.append(
    hud,
    challengeBar,
    el('div', {}, { flex: '1', pointerEvents: 'none' }),
    energyBarContainer,
    tapHint
  );

  // ── Beat and rhythm setup ──────────────────────────────────────────────────
  let audioStarted = false;
  let beatUnsub: (() => void) | null = null;

  // Auto-miss handler from rhythm engine
  const unsubMiss = rhythmEngine.onMiss(zone => {
    const prevCombo = scoreState.combo;
    const missResult: RhythmHitResult = { rating: 'miss', zone, targetId: -1 };
    registerRhythmHit(scoreState, missResult);

    character.reactToZone(zone, 'miss');

    if (prevCombo >= 3) {
      crowdMgr.onComboBreak();
      soundSystem.playComboBreak();
    } else {
      soundSystem.playMiss();
    }

    if (challengeProgress) {
      updateChallengeProgress(challengeProgress, scoreState, 'miss');
      updateChallengeUI();
    }

    updateHUD();
  });
  cleanup.push(unsubMiss);

  // ── Canvas pointer handler ─────────────────────────────────────────────────
  const canvasEl = app.view as HTMLCanvasElement;
  canvasEl.style.pointerEvents = 'auto';
  canvasEl.style.touchAction = 'none';

  const handlePointerDown = (e: PointerEvent): void => {
    e.preventDefault();
    haptic('light');

    // First touch: unlock audio and start beat
    if (!audioStarted) {
      audioStarted = true;
      soundSystem.init();
      soundSystem.setEnabled(state.audioEnabled);
      soundSystem.startBeat(BPM, song.style);
      rhythmEngine.start();

      beatUnsub = soundSystem.onBeat((beatNum, beatTime) => {
        rhythmEngine.onBeatFired(beatNum, beatTime);
        beatsScheduled++;
        if (beatsScheduled >= TOTAL_BEATS && !roundEndTriggered) {
          roundEndTriggered = true;
          const travelSec = 4 * (60 / BPM);
          const delayMs = (travelSec + 0.5) * 1000;
          roundEndTimerId = setTimeout(() => { void showResultsOverlay(); }, delayMs);
        }
      });

      // Hide hint after first tap
      tapHint.textContent = '';
    }

    // Convert screen coords to canvas coords
    const rect = canvasEl.getBoundingClientRect();
    const tapX = (e.clientX - rect.left) * (gameEngine.width / rect.width);
    const tapY = (e.clientY - rect.top) * (gameEngine.height / rect.height);

    const audioNow = soundSystem.getAudioCurrentTime() ?? 0;
    const hitResult = rhythmEngine.tryHit(tapX, tapY, audioNow);

    if (hitResult) {
      // Scored rhythm hit
      const points = registerRhythmHit(scoreState, hitResult);
      if (scoreState.comboMultiplier > peakCombo) peakCombo = scoreState.comboMultiplier;
      character.reactToZone(hitResult.zone, hitResult.rating);
      crowdMgr.onRhythmHit(hitResult.rating, scoreState.comboMultiplier);

      if (hitResult.rating === 'perfect') {
        soundSystem.playPerfectHit();
      } else {
        soundSystem.playGoodHit();
      }

      if (points > 0) {
        showFloatingScore(points, tapX, tapY - 30, hitResult.rating === 'perfect');
      }

      checkComboMilestones();

      if (challengeProgress) {
        updateChallengeProgress(challengeProgress, scoreState, hitResult.rating);
        updateChallengeUI();
      }
    } else {
      // Free-form puppeteer (no target hit)
      const zone = rhythmEngine.getTapZone(tapX, tapY);
      character.reactToZone(zone, 'good');
    }

    updateHUD();
  };

  canvasEl.addEventListener('pointerdown', handlePointerDown);
  cleanup.push(() => canvasEl.removeEventListener('pointerdown', handlePointerDown));

  // ── Combo milestone effects ────────────────────────────────────────────────
  function checkComboMilestones(): void {
    const combo = scoreState.combo;
    if (combo === 5) {
      crowdMgr.triggerEffect('spotlight');
      soundSystem.playPowerUp();
    } else if (combo === 10) {
      crowdMgr.triggerEffect('discoBall');
      soundSystem.playPowerUp();
    } else if (combo === 15) {
      crowdMgr.triggerEffect('hypeTrain');
    }

    if (scoreState.consecutivePerfects >= 5) {
      crowdMgr.triggerEffect('confetti');
    }

    if (combo > 0 && combo % 5 === 0) {
      soundSystem.playComboUp();
    }
  }

  // ── HUD helper ─────────────────────────────────────────────────────────────
  function updateHUD(): void {
    scoreNum.textContent = formatScore(scoreState.totalScore);
    comboNum.textContent = `x${scoreState.comboMultiplier.toFixed(1)}`;
    comboNum.style.color = scoreState.combo >= 5 ? '#FFE66D' : '#6BCB77';
  }

  // ── Floating score text ────────────────────────────────────────────────────
  function showFloatingScore(points: number, x: number, y: number, perfect: boolean): void {
    const text = new PIXI.Text(`+${formatScore(points)}`, {
      fontSize: perfect ? 28 : 20,
      fontWeight: '900',
      fill: perfect ? ['#FFFFFF', '#FFE66D'] : ['#FFE66D', '#FF6B6B'],
      stroke: '#333',
      strokeThickness: 3,
    });
    text.anchor.set(0.5);
    text.position.set(x, y);
    fxLayer.addChild(text);

    let vy = -2;
    let age = 0;
    const ticker = (dt: number): void => {
      age += dt / 60;
      text.y += vy;
      vy *= 0.95;
      text.alpha = Math.max(0, 1 - age * 1.5);
      if (text.alpha <= 0) {
        fxLayer.removeChild(text);
        gameEngine.app.ticker.remove(ticker);
      }
    };
    gameEngine.app.ticker.add(ticker);
  }

  // ── Main update loop ───────────────────────────────────────────────────────
  let prevW = W;
  let prevH = H;

  const unsubUpdate = gameEngine.onUpdate(dt => {
    const audioNow = soundSystem.getAudioCurrentTime() ?? 0;

    character.update(dt);
    rhythmEngine.update(dt, audioNow);
    crowdMgr.update(dt);

    tickScore(scoreState, dt, state.activeMove);
    energyBarFill.style.width = `${crowdMgr.energyLevel * 100}%`;

    // Handle window resize
    if (gameEngine.width !== prevW || gameEngine.height !== prevH) {
      prevW = gameEngine.width;
      prevH = gameEngine.height;
      bgGfx.clear();
      drawBackground(bgGfx, gameEngine.width, gameEngine.height);
      character.container.position.set(gameEngine.width / 2, gameEngine.height * 0.55);
    }
  });

  cleanup.push(unsubUpdate);
  cleanup.push(() => {
    if (roundEndTimerId !== null) clearTimeout(roundEndTimerId);
    if (beatUnsub) beatUnsub();
    soundSystem.stopBeat();
    rhythmEngine.destroy();
    crowdMgr.destroy();
    app.stage.removeChild(bgLayer, crowdLayer, characterLayer, rhythmLayer, fxLayer);
  });

  // ── Score submission (shared by both exit paths) ───────────────────────────
  async function submitScore(): Promise<void> {
    if (scoreState.totalScore <= 0) return;

    const entry = {
      score: scoreState.totalScore,
      mode: 'rhythm',
      metadata: {
        perfectHits: scoreState.perfectHits,
        goodHits: scoreState.goodHits,
        totalHits: scoreState.totalHitAttempts,
        comboPeak: peakCombo,
        duration: Math.floor((Date.now() - scoreState.sessionStart) / 1000),
      },
    };

    await dataService.submitScore(state.profile.id, entry);

    if (challengeProgress?.completed) {
      await dataService.saveChallengeCompletion(
        state.profile.id, today, challengeProgress, challenge
      );
    }
  }

  // ── Results overlay (shown at natural round end) ───────────────────────────
  async function showResultsOverlay(): Promise<void> {
    soundSystem.stopBeat();
    rhythmEngine.stop();
    soundSystem.playVictory();

    // Apply session bonus
    const bonus = calculateSessionBonus(scoreState);
    if (bonus > 0) {
      scoreState.crowdHype += bonus;
      scoreState.totalScore = Math.floor(scoreState.crowdHype);
    }

    await submitScore();

    const total = Math.max(1, scoreState.totalHitAttempts);
    const accuracy = (scoreState.perfectHits + scoreState.goodHits) / total;
    const grade = computeGrade(accuracy);
    const misses = scoreState.totalHitAttempts - scoreState.perfectHits - scoreState.goodHits;

    const overlay = document.createElement('div');
    overlay.style.cssText = [
      'position:absolute', 'inset:0', 'display:flex', 'flex-direction:column',
      'align-items:center', 'justify-content:center',
      'background:rgba(10,0,25,0.92)', 'padding:24px', 'box-sizing:border-box',
      'z-index:100',
    ].join(';');

    // Song + grade header
    const songHeader = document.createElement('div');
    songHeader.textContent = `${song.emoji} ${song.name}`;
    songHeader.style.cssText = 'font-size:18px;color:rgba(255,255,255,0.6);margin-bottom:8px;text-align:center;';

    const gradeEl = document.createElement('div');
    gradeEl.textContent = grade;
    gradeEl.style.cssText = [
      `font-size:clamp(80px,22vw,120px)`, 'font-weight:900', 'line-height:1',
      `color:${gradeColor(grade)}`,
      'text-shadow:0 0 40px currentColor',
      'margin-bottom:12px',
    ].join(';');

    const accuracyEl = document.createElement('div');
    accuracyEl.textContent = `${Math.round(accuracy * 100)}% accuracy`;
    accuracyEl.style.cssText = 'font-size:20px;color:rgba(255,255,255,0.75);margin-bottom:24px;font-weight:700;';

    // Stats grid
    const grid = document.createElement('div');
    grid.style.cssText = [
      'display:grid', 'grid-template-columns:1fr 1fr', 'gap:10px',
      'width:100%', 'max-width:320px', 'margin-bottom:28px',
    ].join(';');

    const stats: Array<[string, string]> = [
      ['Perfect', String(scoreState.perfectHits)],
      ['Good',    String(scoreState.goodHits)],
      ['Miss',    String(misses)],
      ['Peak ×',  peakCombo.toFixed(1)],
      ['Bonus',   `+${bonus}`],
      ['Score',   String(scoreState.totalScore)],
    ];

    for (const [label, value] of stats) {
      const cell = document.createElement('div');
      cell.style.cssText = [
        'background:rgba(255,255,255,0.07)', 'border-radius:12px',
        'padding:10px 14px', 'text-align:center',
      ].join(';');
      const valEl = document.createElement('div');
      valEl.textContent = value;
      valEl.style.cssText = 'font-size:22px;font-weight:900;color:#fff;';
      const lblEl = document.createElement('div');
      lblEl.textContent = label;
      lblEl.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.45);font-weight:700;letter-spacing:1px;margin-top:2px;';
      cell.append(valEl, lblEl);
      grid.appendChild(cell);
    }

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:12px;width:100%;max-width:320px;';

    const againBtn = document.createElement('button');
    againBtn.textContent = '▶️ Play Again';
    againBtn.style.cssText = [
      'flex:1', 'padding:16px', 'font-size:16px', 'font-weight:800',
      'background:#6C3FF5', 'color:#fff', 'border:none', 'border-radius:14px',
      'cursor:pointer', 'font-family:inherit',
    ].join(';');
    againBtn.addEventListener('pointerdown', () => {
      haptic('medium');
      navigate('song-select');
    });

    const homeBtn = document.createElement('button');
    homeBtn.textContent = '🏠 Home';
    homeBtn.style.cssText = [
      'flex:1', 'padding:16px', 'font-size:16px', 'font-weight:800',
      'background:rgba(255,255,255,0.1)', 'color:#fff', 'border:none', 'border-radius:14px',
      'cursor:pointer', 'font-family:inherit',
    ].join(';');
    homeBtn.addEventListener('pointerdown', () => {
      haptic('light');
      navigate('home');
    });

    btnRow.append(againBtn, homeBtn);
    overlay.append(songHeader, gradeEl, accuracyEl, grid, btnRow);
    root.appendChild(overlay);
  }

  // ── Session finish (early exit via ✕ button) ───────────────────────────────
  async function finishSession(): Promise<void> {
    if (roundEndTriggered) return;  // round already ended normally
    if (roundEndTimerId !== null) clearTimeout(roundEndTimerId);

    const bonus = calculateSessionBonus(scoreState);
    if (bonus > 0) {
      scoreState.crowdHype += bonus;
      scoreState.totalScore = Math.floor(scoreState.crowdHype);
    }

    await submitScore();
  }

  return {
    element: root,
    cleanup: () => {
      for (const fn of cleanup) fn();
    },
  };
}

// ─── Background Drawing ───────────────────────────────────────────────────────

function drawBackground(g: PIXI.Graphics, W: number, H: number): void {
  // Sky gradient (simulated with multiple rects)
  g.beginFill(0x1a0533);
  g.drawRect(0, 0, W, H);
  g.endFill();

  // Stage floor
  const floorY = H * 0.72;
  g.beginFill(0x2d0a5e);
  g.drawRect(0, floorY, W, H - floorY);
  g.endFill();

  // Floor edge highlight
  g.lineStyle(2, 0x6C3FF5, 0.8);
  g.moveTo(0, floorY);
  g.lineTo(W, floorY);
  g.lineStyle(0);

  // Stage lights (circles from top)
  const lightColors = [0xFF6B6B, 0xFFE66D, 0x6BCB77, 0x4D96FF, 0xC77DFF];
  for (let i = 0; i < 5; i++) {
    const lx = (W / 6) * (i + 0.5);
    g.beginFill(lightColors[i % lightColors.length], 0.08);
    g.drawEllipse(lx, 0, 60, H * 0.55);
    g.endFill();
  }

  // Disco ball sparkles
  for (let i = 0; i < 20; i++) {
    const sx = Math.random() * W;
    const sy = Math.random() * H * 0.5;
    const sr = 1 + Math.random() * 2;
    g.beginFill(0xFFFFFF, 0.4 + Math.random() * 0.4);
    g.drawCircle(sx, sy, sr);
    g.endFill();
  }

  // Floor tiles pattern
  const tileW = W / 8;
  const tileH = (H - floorY) / 3;
  for (let tx = 0; tx < 8; tx++) {
    for (let ty = 0; ty < 3; ty++) {
      if ((tx + ty) % 2 === 0) {
        g.beginFill(0x3d0a7e, 0.4);
        g.drawRect(tx * tileW, floorY + ty * tileH, tileW, tileH);
        g.endFill();
      }
    }
  }
}
