// ─── Shared UI Component Utilities ───────────────────────────────────────────

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  styles: Record<string, string> = {}
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'textContent') element.textContent = v;
    else if (k === 'innerHTML') element.innerHTML = v;
    else element.setAttribute(k, v);
  }
  for (const [k, v] of Object.entries(styles)) {
    (element.style as unknown as Record<string, string>)[k] = v;
  }
  return element;
}

export function btn(
  label: string,
  onClick: () => void,
  variant: 'primary' | 'secondary' | 'danger' | 'ghost' = 'primary'
): HTMLButtonElement {
  const b = document.createElement('button');
  b.innerHTML = label;
  b.setAttribute('aria-label', label.replace(/<[^>]+>/g, ''));

  const variantCss: Record<string, string> = {
    primary: 'background:linear-gradient(135deg,#6C3FF5,#FF6B6B);color:#fff;',
    secondary: 'background:rgba(255,255,255,0.12);color:#fff;border:1.5px solid rgba(255,255,255,0.25);',
    danger: 'background:linear-gradient(135deg,#FF4444,#CC0000);color:#fff;',
    ghost: 'background:transparent;color:rgba(255,255,255,0.7);border:1.5px solid rgba(255,255,255,0.2);',
  };

  b.style.cssText = `
    display:flex;align-items:center;justify-content:center;gap:8px;
    padding:14px 24px;border-radius:16px;border:none;
    font-size:17px;font-weight:700;font-family:inherit;
    cursor:pointer;user-select:none;-webkit-user-select:none;
    touch-action:manipulation;transition:transform 0.1s,opacity 0.1s;
    min-height:52px;${variantCss[variant] ?? variantCss.primary}
  `;

  b.addEventListener('pointerdown', () => { b.style.transform = 'scale(0.95)'; });
  b.addEventListener('pointerup', () => { b.style.transform = ''; });
  b.addEventListener('pointerleave', () => { b.style.transform = ''; });
  b.addEventListener('click', onClick);

  return b;
}

export function colorSwatch(
  color: string,
  selected: boolean,
  onSelect: (color: string) => void
): HTMLButtonElement {
  const b = document.createElement('button');
  b.style.cssText = `
    width: 36px; height: 36px; border-radius: 50%;
    border: 3px solid ${selected ? '#fff' : 'transparent'};
    background: ${color};
    cursor: pointer; outline: none;
    transition: border-color 0.15s, transform 0.1s;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    flex-shrink: 0;
  `;
  b.setAttribute('aria-label', `Color ${color}`);
  b.addEventListener('click', () => onSelect(color));
  return b;
}

export function section(title: string, content: HTMLElement[]): HTMLDivElement {
  const div = document.createElement('div');
  div.style.cssText = 'margin-bottom: 20px;';

  const h = document.createElement('h3');
  h.textContent = title;
  h.style.cssText = 'font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.55); margin-bottom: 10px;';
  div.appendChild(h);

  for (const c of content) div.appendChild(c);
  return div;
}

export function optionRow(
  options: string[],
  selected: string,
  onChange: (val: string) => void,
  labelMap?: Record<string, string>
): HTMLDivElement {
  const row = document.createElement('div');
  row.style.cssText = 'display: flex; flex-wrap: wrap; gap: 8px;';

  for (const opt of options) {
    const b = document.createElement('button');
    b.textContent = labelMap?.[opt] ?? opt;
    b.style.cssText = `
      padding: 8px 14px; border-radius: 12px; border: 2px solid;
      font-size: 14px; font-weight: 600; font-family: inherit;
      cursor: pointer; transition: all 0.15s; white-space: nowrap;
      ${opt === selected
        ? 'background: rgba(108,63,245,0.9); border-color: #fff; color: #fff;'
        : 'background: rgba(255,255,255,0.08); border-color: transparent; color: rgba(255,255,255,0.7);'
      }
    `;
    b.addEventListener('click', () => onChange(opt));
    row.appendChild(b);
  }

  return row;
}

export function colorPalette(
  colors: string[],
  selected: string,
  onChange: (color: string) => void
): HTMLDivElement {
  const row = document.createElement('div');
  row.style.cssText = 'display: flex; flex-wrap: wrap; gap: 8px; align-items: center;';
  for (const c of colors) {
    row.appendChild(colorSwatch(c, c === selected, onChange));
  }
  return row;
}

/** Haptic feedback */
export function haptic(style: 'light' | 'medium' | 'heavy' = 'light'): void {
  try {
    const durations: Record<string, number[]> = {
      light: [10],
      medium: [20],
      heavy: [40],
    };
    navigator.vibrate?.(durations[style]);
  } catch {
    // ignore
  }
}

/** Format large numbers */
export function formatScore(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}
