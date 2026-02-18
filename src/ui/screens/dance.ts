import * as PIXI from 'pixi.js';
import Matter from 'matter-js';
import { GameState, GameScreen, DanceMoveId, DANCE_MOVES, PhysicsObjectType, PHYSICS_OBJECTS } from '@/types';
import { btn, haptic, el, formatScore } from '@/ui/components/button';
import { GameEngine } from '@/game/engine';
import { Character } from '@/game/character';
import { ObjectManager, MAX_OBJECTS } from '@/game/objects';
import {
  createScoreState,
  tickScore,
  registerCollision,
  registerDanceMove,
  generateDailyChallenge,
  getTodayDateStr,
  createChallengeProgress,
  updateChallengeProgress,
  ChallengeProgress,
} from '@/game/scoring';
import { soundSystem } from '@/game/sounds';
import { dataService } from '@/services/supabase/data';

// ─── Screen shake ─────────────────────────────────────────────────────────────

let shakeIntensity = 0;
function triggerShake(intensity: number): void {
  shakeIntensity = Math.max(shakeIntensity, intensity);
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
  const { app, world } = gameEngine;
  const W = gameEngine.width;
  const H = gameEngine.height;

  // Stage layers
  const bgLayer = new PIXI.Container();
  const objectLayer = new PIXI.Container();
  const characterLayer = new PIXI.Container();
  const fxLayer = new PIXI.Container();

  app.stage.addChild(bgLayer);
  app.stage.addChild(objectLayer);
  app.stage.addChild(characterLayer);
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

  // Object manager
  const objectMgr = new ObjectManager(world, objectLayer);
  objectMgr.setCharacterPosition(charX, charY);

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
      updateChallengeUI();
    } else {
      updateChallengeUI();
    }
  });

  // Collision detection zone (character body roughly)
  const charHitR = 70;

  // ── Score HUD ──────────────────────────────────────────────────────────────
  const hud = el('div', {}, {
    pointerEvents: 'none',
    padding: 'max(env(safe-area-inset-top,8px),8px) 16px 0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  });

  const scoreEl = el('div', {}, {
    textAlign: 'center',
  });
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
    if (cond.type === 'drop_object') {
      const done = challengeProgress.dropsWhileDancing;
      const total = cond.count ?? 1;
      challengeText.textContent = `${challenge.description} (${done}/${total})`;
    }
    if (challengeProgress.completed && !challengeRewarded) {
      challengeRewarded = true;
      challengeText.textContent = '🎉 Challenge Complete! Bonus: ' + challenge.rewardPoints + ' Hype!';
      challengeIcon.textContent = '🏆';
      scoreState.crowdHype += challenge.rewardPoints;
      soundSystem.playChallengeComplete();
      haptic('heavy');
    } else if (challengeProgress.completed) {
      challengeText.textContent = '🎉 Challenge Complete! Bonus: ' + challenge.rewardPoints + ' Hype!';
      challengeIcon.textContent = '🏆';
    }
  }

  // ── Move buttons ───────────────────────────────────────────────────────────
  const movePanel = el('div', {}, {
    pointerEvents: 'auto',
    margin: '0 16px',
    display: 'flex',
    gap: '8px',
    justifyContent: 'center',
    flexWrap: 'wrap',
  });

  const moveBtnMap = new Map<DanceMoveId, HTMLButtonElement>();

  const moveIds: DanceMoveId[] = ['wiggle', 'robot', 'worm', 'flail', 'spin'];
  for (const moveId of moveIds) {
    const move = DANCE_MOVES[moveId];
    const mb = document.createElement('button');
    mb.innerHTML = `${move.emoji}<br><span style="font-size:12px">${move.label}</span>`;
    mb.setAttribute('aria-label', `Dance move: ${move.label}`);
    mb.style.cssText = `
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      width: 64px; height: 64px; border-radius: 18px; border: 2px solid rgba(255,255,255,0.2);
      background: rgba(255,255,255,0.08); color: #fff; cursor: pointer; font-size: 22px;
      font-family: inherit; touch-action: manipulation; transition: all 0.15s;
      flex-shrink: 0;
    `;
    mb.addEventListener('pointerdown', e => {
      e.preventDefault();
      activateMove(moveId);
    });
    mb.addEventListener('pointerup', () => {
      // keep move active; it times out via score tick
    });
    moveBtnMap.set(moveId, mb);
    movePanel.appendChild(mb);
  }

  function updateMoveButtons(active: DanceMoveId): void {
    for (const [id, mb] of moveBtnMap) {
      if (id === active) {
        mb.style.background = 'rgba(108,63,245,0.8)';
        mb.style.borderColor = '#fff';
        mb.style.transform = 'scale(1.08)';
      } else {
        mb.style.background = 'rgba(255,255,255,0.08)';
        mb.style.borderColor = 'rgba(255,255,255,0.2)';
        mb.style.transform = '';
      }
    }
  }

  let moveTimeout: ReturnType<typeof setTimeout> | null = null;

  function activateMove(moveId: DanceMoveId): void {
    haptic('light');
    soundSystem.init();

    const prev = state.activeMove;
    state.activeMove = moveId;
    character.setDanceMove(moveId);
    registerDanceMove(scoreState, moveId);
    updateMoveButtons(moveId);

    if (prev !== moveId) {
      soundSystem.playDanceStart();
    }

    // Play move sound
    const sounds: Record<DanceMoveId, () => void> = {
      idle: () => {},
      wiggle: () => soundSystem.playWiggle(),
      robot: () => soundSystem.playRobot(),
      worm: () => soundSystem.playWorm(),
      flail: () => soundSystem.playFlail(),
      spin: () => soundSystem.playSpin(),
    };
    sounds[moveId]();

    // Auto-return to idle after move duration
    if (moveTimeout) clearTimeout(moveTimeout);
    const dur = DANCE_MOVES[moveId].duration;
    if (isFinite(dur)) {
      moveTimeout = setTimeout(() => {
        state.activeMove = 'idle';
        character.setDanceMove('idle');
        updateMoveButtons('idle');
      }, dur);
    }
  }

  // ── Object tray ────────────────────────────────────────────────────────────
  const trayScroll = el('div', {}, {
    overflowX: 'auto',
    padding: '0 16px',
    pointerEvents: 'auto',
  });

  const tray = el('div', {}, {
    display: 'flex',
    gap: '8px',
    paddingBottom: '4px',
    justifyContent: 'flex-start',
  });

  const objTypes: PhysicsObjectType[] = ['beachball', 'duck', 'pillows', 'taco', 'watermelon', 'bowling', 'anvil', 'feather'];

  for (const objType of objTypes) {
    const def = PHYSICS_OBJECTS[objType];
    const ob = document.createElement('button');
    ob.style.cssText = `
      display: flex; flex-direction: column; align-items: center; gap: 2px;
      padding: 8px 10px; border-radius: 14px; border: 1.5px solid rgba(255,255,255,0.15);
      background: rgba(255,255,255,0.07); color: #fff; cursor: pointer;
      font-size: 24px; font-family: inherit; flex-shrink: 0; touch-action: manipulation;
    `;
    ob.innerHTML = `${def.emoji}<span style="font-size:9px;color:rgba(255,255,255,0.5)">${def.label.split(' ')[0]}</span>`;
    ob.setAttribute('aria-label', `Drop ${def.label}`);

    ob.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (objectMgr.count >= MAX_OBJECTS) {
        haptic('light');
        return;
      }
      haptic('medium');
      soundSystem.init();
      soundSystem.playDrop();
      const w = gameEngine.width;
      const h = gameEngine.height;
      const dropped = objectMgr.drop(objType, w, h);
      if (dropped) {
        scoreState.objectsDropped++;
        if (challengeProgress) {
          updateChallengeProgress(challengeProgress, scoreState, state.activeMove, objType);
        }
        updateChallengeUI();
      }
    });

    tray.appendChild(ob);
  }

  // Clear button
  const clearBtn = document.createElement('button');
  clearBtn.innerHTML = '🗑️<span style="font-size:9px;display:block;color:rgba(255,255,255,0.5)">Clear</span>';
  clearBtn.style.cssText = `
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    padding: 8px 10px; border-radius: 14px; border: 1.5px solid rgba(255,80,80,0.3);
    background: rgba(255,50,50,0.1); color: #fff; cursor: pointer;
    font-size: 24px; font-family: inherit; flex-shrink: 0; touch-action: manipulation;
  `;
  clearBtn.addEventListener('click', () => {
    haptic('medium');
    objectMgr.clearAll();
  });
  tray.appendChild(clearBtn);

  trayScroll.appendChild(tray);

  // ── Bottom spacer ──────────────────────────────────────────────────────────
  const bottomBar = el('div', {}, {
    pointerEvents: 'auto',
    paddingBottom: 'max(env(safe-area-inset-bottom,12px),12px)',
    paddingTop: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  });
  bottomBar.append(movePanel, trayScroll);

  root.append(hud, challengeBar, el('div', {}, { flex: '1', pointerEvents: 'none' }), bottomBar);

  // ── Swipe gesture for move intensity ──────────────────────────────────────
  let swipeStart: { x: number; y: number } | null = null;

  const canvasEl = app.view as HTMLCanvasElement;
  canvasEl.style.pointerEvents = 'auto';

  const handleTouchStart = (e: TouchEvent): void => {
    if (e.touches.length === 1) {
      swipeStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchEnd = (e: TouchEvent): void => {
    if (!swipeStart || e.changedTouches.length === 0) return;
    const dx = e.changedTouches[0].clientX - swipeStart.x;
    const dy = e.changedTouches[0].clientY - swipeStart.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 60) {
      // Swipe gesture - trigger flail or spin
      if (Math.abs(dx) > Math.abs(dy)) {
        activateMove('flail');
      } else if (dy < 0) {
        activateMove('spin');
      } else {
        activateMove('worm');
      }
    }
    swipeStart = null;
  };

  canvasEl.addEventListener('touchstart', handleTouchStart, { passive: true });
  canvasEl.addEventListener('touchend', handleTouchEnd, { passive: true });

  // ── Collision detection ────────────────────────────────────────────────────
  const matterCollisionHandler = (event: Matter.IEventCollision<Matter.Engine>): void => {
    for (const pair of event.pairs) {
      const { bodyA, bodyB } = pair;
      // Check if an object body is near the character
      const bodies = [bodyA, bodyB];
      for (const body of bodies) {
        if (body.label?.startsWith('obj_') && body.label !== 'ground') {
          const dx = body.position.x - charX;
          const dy = body.position.y - charY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < charHitR * 1.5) {
            // Find the object
            const obj = objectMgr.activeObjects.find(o => o.body === body);
            if (obj && !obj.hasHitCharacter) {
              obj.hasHitCharacter = true;

              const result = registerCollision(scoreState, obj.type);
              const dir = dx < 0 ? 'left' : 'right';
              character.wobble(result.wobbleIntensity, dir);
              character.showReaction(result.emoji);

              if (!state.reducedMotion) {
                triggerShake(result.wobbleIntensity * 5);
              }

              soundSystem.init();
              soundSystem.playCollision(obj.def.mass);

              // Floating score text
              showFloatingScore(result.points, body.position.x, body.position.y);

              // Update UI
              scoreNum.textContent = formatScore(scoreState.crowdHype);
              comboNum.textContent = `x${scoreState.comboMultiplier.toFixed(1)}`;

              if (scoreState.combo > 0 && scoreState.combo % 5 === 0) {
                soundSystem.playComboUp();
              }

              haptic('medium');
            }
          }
        }
      }
    }
  };

  Matter.Events.on(gameEngine.physicsEngine, 'collisionStart', matterCollisionHandler);

  // ── Floating score text ────────────────────────────────────────────────────
  function showFloatingScore(points: number, x: number, y: number): void {
    const text = new PIXI.Text(`+${formatScore(points)}`, {
      fontSize: 24,
      fontWeight: '900',
      fill: ['#FFE66D', '#FF6B6B'],
      stroke: '#333',
      strokeThickness: 3,
    });
    text.anchor.set(0.5);
    text.position.set(x, y - 20);
    fxLayer.addChild(text);

    let vy = -2;
    let age = 0;
    const ticker = (dt: number): void => {
      age += dt / 60;
      text.y += vy;
      vy *= 0.96;
      text.alpha = Math.max(0, 1 - age * 1.5);
      if (text.alpha <= 0) {
        fxLayer.removeChild(text);
        gameEngine.app.ticker.remove(ticker);
      }
    };
    gameEngine.app.ticker.add(ticker);
  }

  // ── Main update loop ───────────────────────────────────────────────────────
  const unsubUpdate = gameEngine.onUpdate(dt => {
    // Update character
    character.update(dt);

    // Update objects
    objectMgr.update(dt, gameEngine.height);

    // Tick score
    tickScore(scoreState, dt, state.activeMove);
    scoreNum.textContent = formatScore(scoreState.crowdHype);
    comboNum.textContent = `x${scoreState.comboMultiplier.toFixed(1)}`;

    // Screen shake
    if (shakeIntensity > 0.5 && !state.reducedMotion) {
      const sx = (Math.random() - 0.5) * shakeIntensity;
      const sy = (Math.random() - 0.5) * shakeIntensity;
      app.stage.position.set(sx, sy);
      shakeIntensity *= 0.82;
    } else {
      app.stage.position.set(0, 0);
      shakeIntensity = 0;
    }

    // Handle window resize
    if (gameEngine.width !== bgGfx.width || gameEngine.height !== bgGfx.height) {
      bgGfx.clear();
      drawBackground(bgGfx, gameEngine.width, gameEngine.height);
      const newW = gameEngine.width;
      const newH = gameEngine.height;
      character.container.position.set(newW / 2, newH * 0.55);
      objectMgr.setCharacterPosition(newW / 2, newH * 0.55);
    }
  });

  cleanup.push(unsubUpdate);
  cleanup.push(() => {
    Matter.Events.off(gameEngine.physicsEngine, 'collisionStart', matterCollisionHandler as () => void);
  });
  cleanup.push(() => {
    canvasEl.removeEventListener('touchstart', handleTouchStart);
    canvasEl.removeEventListener('touchend', handleTouchEnd);
  });
  cleanup.push(() => {
    objectMgr.clearAll();
    app.stage.removeChild(bgLayer, objectLayer, characterLayer, fxLayer);
    if (moveTimeout) clearTimeout(moveTimeout);
  });

  // ── Session finish ─────────────────────────────────────────────────────────
  async function finishSession(): Promise<void> {
    if (scoreState.crowdHype <= 0) return;

    const entry = {
      score: Math.floor(scoreState.crowdHype),
      mode: 'classic',
      metadata: {
        objectsDropped: scoreState.objectsDropped,
        collisions: scoreState.collisionsCount,
        comboPeak: scoreState.comboMultiplier,
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
