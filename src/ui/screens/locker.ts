import { GameState, GameScreen, SavedOutfit, CustomizationData } from '@/types';
import { btn, el, haptic } from '@/ui/components/button';
import { dataService } from '@/services/supabase/data';

export function createLockerScreen(
  state: GameState,
  navigate: (screen: GameScreen) => void,
  onApplyOutfit: (cust: CustomizationData) => void
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

  const titleEl = el('h2', { textContent: '🗄️ My Locker' }, {
    fontSize: '20px', fontWeight: '800', margin: '0',
  });

  topBar.append(backBtn, titleEl, el('div', {}, { width: '80px' }));

  // Info text
  const info = el('p', {
    textContent: 'Your saved outfit presets. Tap to apply, swipe or press 🗑️ to delete.',
  }, {
    margin: '0 16px 12px',
    fontSize: '13px',
    color: 'rgba(255,255,255,0.4)',
    flexShrink: '0',
  });

  // Loading
  const loadingEl = el('div', { textContent: 'Loading outfits...' }, {
    textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)', fontSize: '15px',
  });

  const list = el('div', {}, {
    flex: '1',
    overflowY: 'auto',
    padding: '0 16px',
    paddingBottom: 'max(env(safe-area-inset-bottom,16px),16px)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  });

  list.appendChild(loadingEl);
  root.append(topBar, info, list);

  // Load outfits
  dataService.getOutfits(state.profile.id).then(outfits => {
    list.removeChild(loadingEl);

    if (outfits.length === 0) {
      list.appendChild(el('div', {}, {
        textAlign: 'center', padding: '40px 16px',
      }));
      const emptyMsg = el('div', {
        innerHTML: '🕺<br><br>No saved outfits yet!<br><span style="color:rgba(255,255,255,0.4);font-size:13px">Create outfits in the Customize screen.</span>',
      }, {
        textAlign: 'center',
        color: '#fff',
        fontSize: '16px',
        lineHeight: '1.6',
      });
      list.appendChild(emptyMsg);
      return;
    }

    for (const outfit of outfits) {
      list.appendChild(createOutfitCard(outfit, state, onApplyOutfit, navigate, () => {
        // Reload
        list.innerHTML = '';
        list.appendChild(loadingEl);
        dataService.getOutfits(state.profile.id).then(updated => {
          list.removeChild(loadingEl);
          for (const o of updated) {
            list.appendChild(createOutfitCard(o, state, onApplyOutfit, navigate, () => {}));
          }
          if (updated.length === 0) {
            list.appendChild(el('div', { textContent: 'No more outfits.' }, {
              textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)',
            }));
          }
        });
      }));
    }
  });

  return root;
}

function createOutfitCard(
  outfit: SavedOutfit,
  state: GameState,
  onApply: (cust: CustomizationData) => void,
  navigate: (screen: GameScreen) => void,
  onDelete: () => void
): HTMLElement {
  const card = el('div', {}, {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 16px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '16px',
  });

  // Mini preview (color swatches)
  const preview = el('div', {}, {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flexShrink: '0',
  });

  const colors = [
    outfit.customization.topColor,
    outfit.customization.bottomColor,
    outfit.customization.shoeColor,
  ];

  for (const color of colors) {
    const swatch = el('div', {}, {
      width: '20px',
      height: '10px',
      borderRadius: '4px',
      background: color,
      border: '1px solid rgba(255,255,255,0.2)',
    });
    preview.appendChild(swatch);
  }

  // Info
  const info = el('div', {}, { flex: '1', minWidth: '0' });
  const nameEl = el('div', { textContent: outfit.name }, {
    fontWeight: '700', fontSize: '16px',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  });
  const subEl = el('div', {
    textContent: `${outfit.customization.hairStyle} hair · ${outfit.customization.outfitTop}`,
  }, {
    fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginTop: '2px',
  });
  info.append(nameEl, subEl);

  // Actions
  const actions = el('div', {}, { display: 'flex', gap: '8px', flexShrink: '0' });

  const applyBtn = btn('Wear', () => {
    haptic('medium');
    state.profile.customization = { ...outfit.customization };
    onApply({ ...outfit.customization });
    navigate('home');
  }, 'primary');
  applyBtn.style.cssText += 'padding: 8px 12px; font-size: 13px; min-height: 36px;';

  const deleteBtn = btn('🗑️', async () => {
    haptic('light');
    if (outfit.id) {
      await dataService.deleteOutfit(state.profile.id, outfit.id);
    }
    onDelete();
  }, 'danger');
  deleteBtn.style.cssText += 'padding: 8px 10px; font-size: 16px; min-height: 36px;';

  actions.append(applyBtn, deleteBtn);
  card.append(preview, info, actions);
  return card;
}
