import { Component, signal } from '@angular/core';
import { Popover } from 'primeng/popover';
import { palette, updatePrimaryPalette } from '@primeng/themes';

interface PrimarySwatch {
  name: string;
  hex: string;
}

interface ITheme {
  isDark: boolean;
  primaryColor: string;
}

const THEME_KEY = 'pcmc_theme';
// const DARK_KEY = 'pcmc_theme_dark';
// const PRIMARY_KEY = 'pcmc_theme_primary';
const DARK_CLASS = 'app-dark';

/**
 * Top-bar widget: a dark/light mode toggle plus a primary-colour palette picker.
 * Dark mode toggles the `.app-dark` class (PrimeNG's darkModeSelector) on <body>;
 * the palette picker swaps the PrimeNG primary colour scale at runtime. Both
 * choices persist in localStorage and are re-applied on load.
 */
@Component({
  selector: 'app-theme-switcher',
  imports: [Popover],
  templateUrl: './theme-switcher.component.html',
  styleUrl: './theme-switcher.component.scss',
})
export class ThemeSwitcherComponent {
  readonly isDark = signal(true);
  readonly selectedPrimary = signal('emerald');

  private get storedTheme(): ITheme | null {
    const json = localStorage.getItem(THEME_KEY);
    if (!json) return null;
    try {
      return JSON.parse(json) as ITheme;
    } catch {
      return null;
    }
  }

  private setTheme(theme: ITheme | null) {
    if (!theme) {
      localStorage.removeItem(THEME_KEY);
    } else {
      localStorage.setItem(THEME_KEY, JSON.stringify(theme));
    }
  }

  // Curated primary colours (Tailwind 500 shades) — two rows in the palette.
  readonly primaryColors: PrimarySwatch[] = [
    { name: 'slate', hex: '#64748b' },
    { name: 'gray', hex: '#6b7280' },
    { name: 'zinc', hex: '#71717a' },
    { name: 'neutral', hex: '#737373' },
    { name: 'stone', hex: '#78716c' },
    { name: 'amber', hex: '#f59e0b' },
    { name: 'yellow', hex: '#eab308' },
    { name: 'sky', hex: '#0ea5e9' },
    { name: 'cyan', hex: '#06b6d4' },
    { name: 'teal', hex: '#14b8a6' },
    { name: 'emerald', hex: '#10b981' },
    { name: 'green', hex: '#22c55e' },
    { name: 'lime', hex: '#84cc16' },
    { name: 'orange', hex: '#f97316' },
    { name: 'blue', hex: '#3b82f6' },
    { name: 'indigo', hex: '#6366f1' },
    { name: 'violet', hex: '#8b5cf6' },
    { name: 'purple', hex: '#a855f7' },
    { name: 'fuchsia', hex: '#d946ef' },
    { name: 'pink', hex: '#ec4899' },
    { name: 'rose', hex: '#f43f5e' },
  ];

  constructor() {
    // Restore persisted dark mode (default: dark, matching the shipped theme).
    const storedTheme = this.storedTheme;
    this.isDark.set(storedTheme == null ? true : storedTheme.isDark);
    this.applyDark(this.isDark());

    // Restore persisted primary colour.
    const storedPrimary = storedTheme?.primaryColor;
    const initial = this.primaryColors.find(c => c.name === storedPrimary);
    if (initial) {
      this.selectedPrimary.set(initial.name);
      updatePrimaryPalette(palette(initial.hex));
    }
  }

  toggleDark(): void {
    const next = !this.isDark();
    this.isDark.set(next);
    this.applyDark(next);
    this.setTheme({ isDark: next, primaryColor: this.selectedPrimary() });
  }

  selectPrimary(color: PrimarySwatch): void {
    this.selectedPrimary.set(color.name);
    updatePrimaryPalette(palette(color.hex));
    this.setTheme({ isDark: this.isDark(), primaryColor: color.name });
  }

  private applyDark(dark: boolean): void {
    document.body.classList.toggle(DARK_CLASS, dark);
  }
}
