import { GameState, GameScreen, CustomizationData, DEFAULT_CUSTOMIZATION } from '@/types';
import { btn, section, optionRow, colorPalette, haptic, el } from '@/ui/components/button';
import { authService } from '@/services/supabase/auth';
import { dataService } from '@/services/supabase/data';

// ─── Color Palettes ───────────────────────────────────────────────────────────

const HAIR_COLORS = ['#3D1A00', '#5C2D00', '#B8860B', '#FFD700', '#FF4500', '#CC0066', '#6600CC', '#008080', '#FFFFFF', '#111111'];
const OUTFIT_COLORS = ['#FF6B6B', '#FFE66D', '#6BCB77', '#4D96FF', '#C77DFF', '#F4A261', '#264653', '#E76F51', '#2A9D8F', '#FFFFFF', '#111111', '#FF006E'];
const SHOE_COLORS = ['#FFFFFF', '#000000', '#FF4500', '#006400', '#00008B', '#8B0000', '#FFD700', '#708090'];

// ─── Presets ──────────────────────────────────────────────────────────────────

const PRESETS: Array<{ name: string; emoji: string; data: Partial<CustomizationData> }> = [
  { name: 'Classic', emoji: '😎', data: { skinTone: 'medium', hairStyle: 'short', hairColor: '#3D1A00', outfitTop: 'tshirt', topColor: '#FF6B6B', outfitBottom: 'jeans', bottomColor: '#2255AA', shoes: 'sneakers', shoeColor: '#FFFFFF' } },
  { name: 'Disco', emoji: '🪩', data: { skinTone: 'medium-light', hairStyle: 'afro', hairColor: '#FFD700', outfitTop: 'suit', topColor: '#FFE66D', outfitBottom: 'pants', bottomColor: '#FFE66D', shoes: 'heels', shoeColor: '#FFD700' } },
  { name: 'Rocker', emoji: '🎸', data: { skinTone: 'light', hairStyle: 'spiky', hairColor: '#CC0066', outfitTop: 'tank', topColor: '#111111', outfitBottom: 'jeans', bottomColor: '#111111', shoes: 'boots', shoeColor: '#111111' } },
  { name: 'Beach', emoji: '🏄', data: { skinTone: 'medium-dark', hairStyle: 'medium', hairColor: '#B8860B', outfitTop: 'tank', topColor: '#4D96FF', outfitBottom: 'shorts', bottomColor: '#FFE66D', shoes: 'sandals', shoeColor: '#F4A261' } },
  { name: 'Cowboy', emoji: '🤠', data: { skinTone: 'medium', hairStyle: 'medium', hairColor: '#5C2D00', outfitTop: 'tshirt', topColor: '#F4A261', outfitBottom: 'jeans', bottomColor: '#264653', shoes: 'boots', shoeColor: '#5C2D00', hat: 'cowboy', hatColor: '#8B4513' } },
  { name: 'Fancy', emoji: '🎩', data: { skinTone: 'light', hairStyle: 'none', hairColor: '#000000', outfitTop: 'suit', topColor: '#111111', outfitBottom: 'pants', bottomColor: '#111111', shoes: 'boots', shoeColor: '#111111', hat: 'tophat', hatColor: '#111111' } },
  { name: 'Neon', emoji: '🌈', data: { skinTone: 'dark', hairStyle: 'bun', hairColor: '#FF006E', outfitTop: 'hoodie', topColor: '#C77DFF', outfitBottom: 'joggers', bottomColor: '#FF006E', shoes: 'sneakers', shoeColor: '#FFE66D', glasses: 'round', glassesColor: '#00FFFF' } },
  { name: 'Cozy', emoji: '🧸', data: { skinTone: 'medium-light', hairStyle: 'long', hairColor: '#B8860B', outfitTop: 'sweater', topColor: '#E76F51', outfitBottom: 'joggers', bottomColor: '#8B4513', shoes: 'sneakers', shoeColor: '#FFFFFF', hat: 'beanie', hatColor: '#C77DFF' } },
];

// ─── Customize Screen ─────────────────────────────────────────────────────────

export function createCustomizeScreen(
  state: GameState,
  navigate: (screen: GameScreen) => void,
  onCustomizationChange: (cust: CustomizationData) => void
): HTMLElement {
  let currentCust: CustomizationData = { ...state.profile.customization };

  const root = el('div', {}, {
    position: 'absolute',
    inset: '0',
    display: 'flex',
    flexDirection: 'column',
    background: 'linear-gradient(160deg, #1a0533, #2d0a5e)',
    overflow: 'hidden',
  });

  // ── Top bar ────────────────────────────────────────────────────────────────
  const topBar = el('div', {}, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'max(env(safe-area-inset-top,16px),16px) 20px 12px',
    flexShrink: '0',
  });

  const backBtn = btn('← Back', () => navigate('home'), 'ghost');
  backBtn.style.padding = '10px 16px';

  const titleEl = el('h2', { textContent: '👗 Customize' }, {
    fontSize: '20px', fontWeight: '800', margin: '0',
  });

  const saveBtn = btn('✅ Save', async () => {
    haptic('medium');
    await authService.updateProfile({ customization: currentCust });
    state.profile.customization = currentCust;
    onCustomizationChange(currentCust);
    navigate('home');
  }, 'primary');
  saveBtn.style.padding = '10px 16px';

  topBar.append(backBtn, titleEl, saveBtn);

  // ── Preset strip ───────────────────────────────────────────────────────────
  const presetStrip = el('div', {}, {
    padding: '0 16px 8px',
    flexShrink: '0',
  });

  const presetLabel = el('p', { textContent: 'Quick Presets' }, {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '8px',
  });

  const presetScroll = el('div', {}, {
    display: 'flex',
    gap: '8px',
    overflowX: 'auto',
    paddingBottom: '4px',
  });

  for (const preset of PRESETS) {
    const pb = document.createElement('button');
    pb.style.cssText = `
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      padding: 10px 14px; border-radius: 14px; border: 1.5px solid rgba(255,255,255,0.15);
      background: rgba(255,255,255,0.07); color: #fff; cursor: pointer;
      flex-shrink: 0; font-size: 12px; font-weight: 600; font-family: inherit;
      white-space: nowrap;
    `;
    pb.innerHTML = `<span style="font-size:22px">${preset.emoji}</span>${preset.name}`;
    pb.addEventListener('click', () => {
      haptic('light');
      currentCust = { ...currentCust, ...preset.data };
      onCustomizationChange(currentCust);
      rebuild();
    });
    presetScroll.appendChild(pb);
  }

  // Randomize button
  const randBtn = document.createElement('button');
  randBtn.style.cssText = `
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    padding: 10px 14px; border-radius: 14px; border: 1.5px solid rgba(255,255,255,0.3);
    background: rgba(108,63,245,0.3); color: #fff; cursor: pointer;
    flex-shrink: 0; font-size: 12px; font-weight: 700; font-family: inherit;
  `;
  randBtn.innerHTML = `<span style="font-size:22px">🎲</span>Random`;
  randBtn.addEventListener('click', () => {
    haptic('medium');
    currentCust = randomize();
    onCustomizationChange(currentCust);
    rebuild();
  });
  presetScroll.appendChild(randBtn);

  presetStrip.append(presetLabel, presetScroll);

  // ── Scrollable options ─────────────────────────────────────────────────────
  const scroll = el('div', {}, {
    flex: '1',
    overflowY: 'auto',
    padding: '0 16px',
    paddingBottom: 'max(env(safe-area-inset-bottom,16px),16px)',
  });

  const formContent = el('div', {}, {});

  function rebuild() {
    formContent.innerHTML = '';

    // Name
    const nameSection = document.createElement('div');
    nameSection.style.marginBottom = '20px';
    const nameLabel = el('h3', { textContent: 'Your Name' }, {
      fontSize: '13px', fontWeight: '700', textTransform: 'uppercase',
      letterSpacing: '1px', color: 'rgba(255,255,255,0.55)', marginBottom: '10px',
    });
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.maxLength = 20;
    nameInput.value = state.profile.displayName;
    nameInput.placeholder = 'Wobbler';
    nameInput.setAttribute('aria-label', 'Display name');
    nameInput.style.cssText = `
      width: 100%; padding: 12px 16px; border-radius: 14px;
      border: 1.5px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.08);
      color: #fff; font-size: 16px; font-family: inherit; box-sizing: border-box;
    `;
    nameInput.addEventListener('input', () => {
      state.profile.displayName = nameInput.value || 'Wobbler';
    });
    nameSection.append(nameLabel, nameInput);
    formContent.appendChild(nameSection);

    // Skin tone
    formContent.appendChild(section('Skin Tone', [
      optionRow(['light','medium-light','medium','medium-dark','dark'], currentCust.skinTone, v => {
        currentCust.skinTone = v as CustomizationData['skinTone'];
        onCustomizationChange(currentCust);
        rebuild();
      }, { light: '🏻', 'medium-light': '🏼', medium: '🏽', 'medium-dark': '🏾', dark: '🏿' }),
    ]));

    // Face shape
    formContent.appendChild(section('Face Shape', [
      optionRow(['round','oval','square'], currentCust.faceShape, v => {
        currentCust.faceShape = v as CustomizationData['faceShape'];
        onCustomizationChange(currentCust);
        rebuild();
      }, { round: '⭕ Round', oval: '🥚 Oval', square: '⬜ Square' }),
    ]));

    // Hair
    formContent.appendChild(section('Hair Style', [
      optionRow(['none','short','medium','long','afro','bun','spiky'], currentCust.hairStyle, v => {
        currentCust.hairStyle = v as CustomizationData['hairStyle'];
        onCustomizationChange(currentCust);
        rebuild();
      }, { none: '🚫 None', short: '✂️ Short', medium: '💇 Medium', long: '👸 Long', afro: '🌟 Afro', bun: '🎀 Bun', spiky: '⚡ Spiky' }),
    ]));

    formContent.appendChild(section('Hair Color', [
      colorPalette(HAIR_COLORS, currentCust.hairColor, v => {
        currentCust.hairColor = v;
        onCustomizationChange(currentCust);
        rebuild();
      }),
    ]));

    // Outfit
    formContent.appendChild(section('Top', [
      optionRow(['tshirt','hoodie','dress','suit','tank','sweater'], currentCust.outfitTop, v => {
        currentCust.outfitTop = v as CustomizationData['outfitTop'];
        onCustomizationChange(currentCust);
        rebuild();
      }, { tshirt: '👕 T-Shirt', hoodie: '🧥 Hoodie', dress: '👗 Dress', suit: '🤵 Suit', tank: '🏋️ Tank', sweater: '🧶 Sweater' }),
    ]));

    formContent.appendChild(section('Top Color', [
      colorPalette(OUTFIT_COLORS, currentCust.topColor, v => {
        currentCust.topColor = v;
        onCustomizationChange(currentCust);
        rebuild();
      }),
    ]));

    formContent.appendChild(section('Bottom', [
      optionRow(['jeans','shorts','skirt','pants','joggers'], currentCust.outfitBottom, v => {
        currentCust.outfitBottom = v as CustomizationData['outfitBottom'];
        onCustomizationChange(currentCust);
        rebuild();
      }, { jeans: '👖 Jeans', shorts: '🩳 Shorts', skirt: '👗 Skirt', pants: '🎽 Pants', joggers: '🏃 Joggers' }),
    ]));

    formContent.appendChild(section('Bottom Color', [
      colorPalette(OUTFIT_COLORS, currentCust.bottomColor, v => {
        currentCust.bottomColor = v;
        onCustomizationChange(currentCust);
        rebuild();
      }),
    ]));

    // Shoes
    formContent.appendChild(section('Shoes', [
      optionRow(['sneakers','boots','heels','sandals','cleats'], currentCust.shoes, v => {
        currentCust.shoes = v as CustomizationData['shoes'];
        onCustomizationChange(currentCust);
        rebuild();
      }, { sneakers: '👟', boots: '🥾', heels: '👠', sandals: '🩴', cleats: '⚽' }),
    ]));

    formContent.appendChild(section('Shoe Color', [
      colorPalette(SHOE_COLORS, currentCust.shoeColor, v => {
        currentCust.shoeColor = v;
        onCustomizationChange(currentCust);
        rebuild();
      }),
    ]));

    // Accessories
    formContent.appendChild(section('Hat', [
      optionRow(['none','cap','tophat','beanie','cowboy'], currentCust.hat, v => {
        currentCust.hat = v as CustomizationData['hat'];
        onCustomizationChange(currentCust);
        rebuild();
      }, { none: '🚫', cap: '🧢 Cap', tophat: '🎩 Top Hat', beanie: '🧣 Beanie', cowboy: '🤠 Cowboy' }),
    ]));

    formContent.appendChild(section('Glasses', [
      optionRow(['none','round','square','heart','shades'], currentCust.glasses, v => {
        currentCust.glasses = v as CustomizationData['glasses'];
        onCustomizationChange(currentCust);
        rebuild();
      }, { none: '🚫', round: '👓 Round', square: '🕶️ Square', heart: '🩷 Heart', shades: '😎 Shades' }),
    ]));

    // Save outfit button
    const saveOutfitBtn = btn('💾 Save as Outfit', async () => {
      haptic('medium');
      const name = prompt('Outfit name:', `Outfit ${Date.now()}`);
      if (!name) return;
      await dataService.saveOutfit(state.profile.id, { name, customization: currentCust });
      alert('Outfit saved to My Locker!');
    }, 'secondary');
    saveOutfitBtn.style.marginTop = '16px';
    formContent.appendChild(saveOutfitBtn);
  }

  rebuild();
  scroll.appendChild(formContent);

  root.append(topBar, presetStrip, scroll);
  return root;
}

// ─── Randomize helper ─────────────────────────────────────────────────────────

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomColor(palette: string[]): string {
  return randomItem(palette);
}

const HAIR_COLORS_ARR = ['#3D1A00','#5C2D00','#B8860B','#FFD700','#FF4500','#CC0066','#6600CC','#008080','#FFFFFF','#111111'];
const OUTFIT_COLORS_ARR = ['#FF6B6B','#FFE66D','#6BCB77','#4D96FF','#C77DFF','#F4A261','#264653','#E76F51','#2A9D8F','#FFFFFF','#111111','#FF006E'];
const SHOE_COLORS_ARR = ['#FFFFFF','#000000','#FF4500','#006400','#00008B','#8B0000','#FFD700'];

function randomize(): CustomizationData {
  return {
    ...DEFAULT_CUSTOMIZATION,
    skinTone: randomItem(['light','medium-light','medium','medium-dark','dark'] as const),
    faceShape: randomItem(['round','oval','square'] as const),
    hairStyle: randomItem(['none','short','medium','long','afro','bun','spiky'] as const),
    hairColor: randomColor(HAIR_COLORS_ARR),
    outfitTop: randomItem(['tshirt','hoodie','dress','suit','tank','sweater'] as const),
    topColor: randomColor(OUTFIT_COLORS_ARR),
    outfitBottom: randomItem(['jeans','shorts','skirt','pants','joggers'] as const),
    bottomColor: randomColor(OUTFIT_COLORS_ARR),
    shoes: randomItem(['sneakers','boots','heels','sandals','cleats'] as const),
    shoeColor: randomColor(SHOE_COLORS_ARR),
    hat: randomItem(['none','cap','tophat','beanie','cowboy'] as const),
    hatColor: randomColor(OUTFIT_COLORS_ARR),
    glasses: randomItem(['none','round','square','heart','shades'] as const),
    glassesColor: randomColor(['#222222','#FF0000','#0000FF','#FFD700','#00FFFF']),
    name: randomItem(['Wobbler','Dancer','Groover','Shaker','Jiggler','Spinner']),
  };
}
