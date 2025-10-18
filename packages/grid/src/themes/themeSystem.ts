import type { ThemeTokens, ResolvedThemeTokens } from '../types';

// CSS Custom Property names
export const CSS_VARIABLES = {
  // Base colors
  '--grid-background': '--grid-background',
  '--grid-foreground': '--grid-foreground',
  '--grid-muted': '--grid-muted',
  '--grid-muted-foreground': '--grid-muted-foreground',
  '--grid-border': '--grid-border',
  '--grid-accent': '--grid-accent',
  '--grid-scrollbar-foreground': '--grid-scrollbar-foreground',

  // Typography
  '--grid-font-mono': '--grid-font-mono',
  '--grid-font-sans': '--grid-font-sans',
  '--grid-text-xs': '--grid-text-xs',
  '--grid-text-sm': '--grid-text-sm',

  // Selection
  '--grid-selection-fill': '--grid-selection-fill',
  '--grid-selection-border': '--grid-selection-border',
  '--grid-selection-border-width': '--grid-selection-border-width',

  // Hover states
  '--grid-hover-row-fill': '--grid-hover-row-fill',
  '--grid-hover-col-fill': '--grid-hover-col-fill',

  // Layout
  '--grid-gridline-width': '--grid-gridline-width',

  // Resize handles
  '--grid-resize-pill-width': '--grid-resize-pill-width',
  '--grid-resize-pill-height': '--grid-resize-pill-height',
  '--grid-resize-dot-radius': '--grid-resize-dot-radius',
  '--grid-resize-line-color': '--grid-resize-line-color',
  '--grid-resize-pill-fill': '--grid-resize-pill-fill',
  '--grid-resize-dot-color': '--grid-resize-dot-color',
  '--grid-resize-dot-opacity': '--grid-resize-dot-opacity',
} as const;

// Default theme values
export const DEFAULT_THEME_TOKENS: ThemeTokens = {
  // Base
  background: '#ffffff',
  foreground: '#000000',
  muted: '#f5f5f5',
  mutedForeground: '#737373',
  border: '#e5e5e5',
  accent: '#2563eb',
  scrollbarForeground: '#d4d4d8',

  // Typography
  fontMono: 'ui-monospace, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
  fontSans: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  textXs: 0.75,  // 12px at 16px base
  textSm: 0.875, // 14px at 16px base

  // Selection (derived from accent if not specified)
  selectionBorderWidth: 2,

  // Layout
  gridlineWidth: 0.5,

  // Resize handles
  resizeHandlePillWidth: 18,
  resizeHandlePillHeight: 36,
  resizeHandleDotRadius: 2.5,
};

// CSS-in-JS utilities for color manipulation
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result && result[1] && result[2] && result[3] ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

export function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("");
}

export function addAlpha(color: string, alpha: number): string {
  const rgb = hexToRgb(color);
  if (rgb) {
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  }
  // Fallback for non-hex colors
  return `${color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
}

export function lighten(color: string, amount: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;

  return rgbToHex(
    Math.min(255, rgb.r + Math.round(255 * amount)),
    Math.min(255, rgb.g + Math.round(255 * amount)),
    Math.min(255, rgb.b + Math.round(255 * amount))
  );
}

export function darken(color: string, amount: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;

  return rgbToHex(
    Math.max(0, rgb.r - Math.round(255 * amount)),
    Math.max(0, rgb.g - Math.round(255 * amount)),
    Math.max(0, rgb.b - Math.round(255 * amount))
  );
}

// Theme resolver that handles CSS variables and derived values
export class ThemeResolver {
  private computedStyle: CSSStyleDeclaration;

  constructor(element?: HTMLElement) {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const target = element ?? document.documentElement;
      this.computedStyle = getComputedStyle(target);
    } else {
      // SSR-safe fallback: minimal interface used by getCSSVar()
      this.computedStyle = {
        getPropertyValue: () => '',
      } as unknown as CSSStyleDeclaration;
    }
  }

  public resolve(partialTheme: Partial<ThemeTokens> = {}): ResolvedThemeTokens {
    const theme: ThemeTokens = { ...DEFAULT_THEME_TOKENS };

    // First, try to get values from CSS variables
    this.applyCSSVariables(theme);

    // Then apply any provided overrides
    Object.assign(theme, partialTheme);

    // Finally, derive any missing values
    this.deriveValues(theme);

    // Coerce to resolved (fill all optionals)
    const resolved: ResolvedThemeTokens = {
      ...theme,
      selectionFill: theme.selectionFill ?? addAlpha(theme.accent, 0.1),
      selectionBorder: theme.selectionBorder ?? theme.accent,
      selectionBorderWidth: theme.selectionBorderWidth ?? 2,
      hoverRowFill: theme.hoverRowFill ?? addAlpha(theme.accent, 0.05),
      hoverColFill: theme.hoverColFill ?? addAlpha(theme.accent, 0.05),
      gridlineWidth: theme.gridlineWidth ?? 0.5,
      resizeHandleLineColor: theme.resizeHandleLineColor ?? theme.accent,
      resizeHandlePillFill: theme.resizeHandlePillFill ?? theme.accent,
      resizeHandleDotColor: theme.resizeHandleDotColor ?? darken(theme.accent, 0.4),
      resizeHandleDotOpacity: theme.resizeHandleDotOpacity ?? 0.6,
    };
    return resolved;
  }

  private applyCSSVariables(theme: ThemeTokens): void {
    // Base colors
    const background = this.getCSSVar('--grid-background');
    if (background) theme.background = background;

    const foreground = this.getCSSVar('--grid-foreground');
    if (foreground) theme.foreground = foreground;

    const muted = this.getCSSVar('--grid-muted');
    if (muted) theme.muted = muted;

    const mutedForeground = this.getCSSVar('--grid-muted-foreground');
    if (mutedForeground) theme.mutedForeground = mutedForeground;

    const border = this.getCSSVar('--grid-border');
    if (border) theme.border = border;

    const accent = this.getCSSVar('--grid-accent');
    if (accent) theme.accent = accent;

    const scrollbarForeground = this.getCSSVar('--grid-scrollbar-foreground');
    if (scrollbarForeground) theme.scrollbarForeground = scrollbarForeground;

    // Typography
    const fontMono = this.getCSSVar('--grid-font-mono');
    if (fontMono) theme.fontMono = fontMono;

    const fontSans = this.getCSSVar('--grid-font-sans');
    if (fontSans) theme.fontSans = fontSans;

    const textXs = this.getCSSVarNumber('--grid-text-xs');
    if (textXs !== null) theme.textXs = textXs;

    const textSm = this.getCSSVarNumber('--grid-text-sm');
    if (textSm !== null) theme.textSm = textSm;

    // Selection
    const selectionFill = this.getCSSVar('--grid-selection-fill');
    if (selectionFill) theme.selectionFill = selectionFill;

    const selectionBorder = this.getCSSVar('--grid-selection-border');
    if (selectionBorder) theme.selectionBorder = selectionBorder;

    const selectionBorderWidth = this.getCSSVarNumber('--grid-selection-border-width');
    if (selectionBorderWidth !== null) theme.selectionBorderWidth = selectionBorderWidth;

    // Hover states
    const hoverRowFill = this.getCSSVar('--grid-hover-row-fill');
    if (hoverRowFill) theme.hoverRowFill = hoverRowFill;

    const hoverColFill = this.getCSSVar('--grid-hover-col-fill');
    if (hoverColFill) theme.hoverColFill = hoverColFill;

    // Layout
    const gridlineWidth = this.getCSSVarNumber('--grid-gridline-width');
    if (gridlineWidth !== null) theme.gridlineWidth = gridlineWidth;

    const resizePillWidth = this.getCSSVarNumber('--grid-resize-pill-width');
    if (resizePillWidth !== null) theme.resizeHandlePillWidth = resizePillWidth;

    const resizePillHeight = this.getCSSVarNumber('--grid-resize-pill-height');
    if (resizePillHeight !== null) theme.resizeHandlePillHeight = resizePillHeight;

    const resizeDotRadius = this.getCSSVarNumber('--grid-resize-dot-radius');
    if (resizeDotRadius !== null) theme.resizeHandleDotRadius = resizeDotRadius;

    const resizeLineColor = this.getCSSVar('--grid-resize-line-color');
    if (resizeLineColor) theme.resizeHandleLineColor = resizeLineColor;

    const resizePillFill = this.getCSSVar('--grid-resize-pill-fill');
    if (resizePillFill) theme.resizeHandlePillFill = resizePillFill;

    const resizeDotColor = this.getCSSVar('--grid-resize-dot-color');
    if (resizeDotColor) theme.resizeHandleDotColor = resizeDotColor;

    const resizeDotOpacity = this.getCSSVarNumber('--grid-resize-dot-opacity');
    if (resizeDotOpacity !== null) theme.resizeHandleDotOpacity = resizeDotOpacity;
  }

  private getCSSVar(name: string): string | null {
    const value = this.computedStyle.getPropertyValue(name).trim();
    return value || null;
  }

  private getCSSVarNumber(name: string): number | null {
    const value = this.getCSSVar(name);
    if (!value) return null;

    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }

  private deriveValues(theme: ThemeTokens): void {
    // Derive selection colors from accent if not specified
    if (!theme.selectionFill) {
      theme.selectionFill = addAlpha(theme.accent, 0.1);
    }

    if (!theme.selectionBorder) {
      theme.selectionBorder = theme.accent;
    }

    // Derive hover colors from accent if not specified
    if (!theme.hoverRowFill) {
      theme.hoverRowFill = addAlpha(theme.accent, 0.05);
    }

    if (!theme.hoverColFill) {
      theme.hoverColFill = addAlpha(theme.accent, 0.05);
    }

    if (!theme.resizeHandleLineColor) {
      theme.resizeHandleLineColor = theme.accent;
    }

    if (!theme.resizeHandlePillFill) {
      theme.resizeHandlePillFill = theme.accent;
    }

    if (!theme.resizeHandleDotColor) {
      theme.resizeHandleDotColor = darken(theme.accent, 0.4);
    }

    if (theme.resizeHandleDotOpacity === undefined) {
      theme.resizeHandleDotOpacity = 0.6;
    }
  }
}

// Utility to set CSS variables on an element
export function setCSSVariables(element: HTMLElement, theme: Partial<ThemeTokens>): void {
  const style = element.style;

  if (theme.background) style.setProperty('--grid-background', theme.background);
  if (theme.foreground) style.setProperty('--grid-foreground', theme.foreground);
  if (theme.muted) style.setProperty('--grid-muted', theme.muted);
  if (theme.mutedForeground) style.setProperty('--grid-muted-foreground', theme.mutedForeground);
  if (theme.border) style.setProperty('--grid-border', theme.border);
  if (theme.accent) style.setProperty('--grid-accent', theme.accent);
  if (theme.scrollbarForeground) style.setProperty('--grid-scrollbar-foreground', theme.scrollbarForeground);

  if (theme.fontMono) style.setProperty('--grid-font-mono', theme.fontMono);
  if (theme.fontSans) style.setProperty('--grid-font-sans', theme.fontSans);
  if (theme.textXs !== undefined) style.setProperty('--grid-text-xs', theme.textXs.toString());
  if (theme.textSm !== undefined) style.setProperty('--grid-text-sm', theme.textSm.toString());

  if (theme.selectionFill) style.setProperty('--grid-selection-fill', theme.selectionFill);
  if (theme.selectionBorder) style.setProperty('--grid-selection-border', theme.selectionBorder);
  if (theme.selectionBorderWidth !== undefined) style.setProperty('--grid-selection-border-width', theme.selectionBorderWidth.toString());

  if (theme.hoverRowFill) style.setProperty('--grid-hover-row-fill', theme.hoverRowFill);
  if (theme.hoverColFill) style.setProperty('--grid-hover-col-fill', theme.hoverColFill);

  if (theme.gridlineWidth !== undefined) style.setProperty('--grid-gridline-width', theme.gridlineWidth.toString());

  if (theme.resizeHandlePillWidth !== undefined) style.setProperty('--grid-resize-pill-width', theme.resizeHandlePillWidth.toString());
  if (theme.resizeHandlePillHeight !== undefined) style.setProperty('--grid-resize-pill-height', theme.resizeHandlePillHeight.toString());
  if (theme.resizeHandleDotRadius !== undefined) style.setProperty('--grid-resize-dot-radius', theme.resizeHandleDotRadius.toString());
  if (theme.resizeHandleLineColor) style.setProperty('--grid-resize-line-color', theme.resizeHandleLineColor);
  if (theme.resizeHandlePillFill) style.setProperty('--grid-resize-pill-fill', theme.resizeHandlePillFill);
  if (theme.resizeHandleDotColor) style.setProperty('--grid-resize-dot-color', theme.resizeHandleDotColor);
  if (theme.resizeHandleDotOpacity !== undefined) style.setProperty('--grid-resize-dot-opacity', theme.resizeHandleDotOpacity.toString());
}

// Pre-defined themes
export const LIGHT_THEME: ThemeTokens = {
  ...DEFAULT_THEME_TOKENS,
};

export const DARK_THEME: ThemeTokens = {
  ...DEFAULT_THEME_TOKENS,
  background: '#000000',
  foreground: '#ffffff',
  muted: '#1a1a1a',
  mutedForeground: '#a3a3a3',
  border: '#333333',
  accent: '#3b82f6',
  scrollbarForeground: '#525252',
};

// Theme context utilities
export function createThemeContext(element: HTMLElement): ThemeResolver {
  return new ThemeResolver(element);
}

// React-friendly theme hook utilities (to be used with the component)
export function getBaseFontSize(element?: HTMLElement): number {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const target = element ?? document.documentElement;
    const fontSize = getComputedStyle(target).fontSize;
    return parseFloat(fontSize) || 16;
  }
  // SSR fallback
  return 16;
}

// Convenience helper to resolve a theme without instantiating the class
export function resolveTheme(partial: Partial<ThemeTokens> = {}): ResolvedThemeTokens {
  return new ThemeResolver().resolve(partial);
}
