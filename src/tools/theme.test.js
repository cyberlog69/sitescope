import { describe, it, expect, beforeEach } from 'vitest';
import {
  AVAILABLE_THEMES,
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  getStoredTheme,
  applyTheme,
  initThemeSwitcher,
} from './theme.js';

describe('theme module', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.className = '';
    delete document.body.dataset.theme;
  });

  it('provides all 4 core themes with metadata', () => {
    expect(Object.keys(AVAILABLE_THEMES)).toEqual(['aurora', 'cyber', 'linear', 'nordic']);
    expect(AVAILABLE_THEMES.cyber.icon).toBe('⚡');
    expect(AVAILABLE_THEMES.linear.icon).toBe('🖤');
    expect(AVAILABLE_THEMES.nordic.icon).toBe('❄️');
    expect(AVAILABLE_THEMES.aurora.icon).toBe('🌌');
  });

  it('returns default aurora theme when storage is empty', () => {
    expect(getStoredTheme()).toBe(DEFAULT_THEME);
  });

  it('reads stored theme from localStorage if valid', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'cyber');
    expect(getStoredTheme()).toBe('cyber');
  });

  it('falls back to default if stored theme is invalid', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'nonexistent_theme');
    expect(getStoredTheme()).toBe(DEFAULT_THEME);
  });

  it('applies theme to document body and updates localStorage', () => {
    const applied = applyTheme('cyber');
    expect(applied).toBe('cyber');
    expect(document.body.dataset.theme).toBe('cyber');
    expect(document.body.classList.contains('theme-cyber')).toBe(true);
    expect(document.body.classList.contains('theme-aurora')).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('cyber');
  });

  it('falls back gracefully to default theme when applying unknown theme', () => {
    const applied = applyTheme('invalid_theme_xyz');
    expect(applied).toBe(DEFAULT_THEME);
    expect(document.body.dataset.theme).toBe(DEFAULT_THEME);
    expect(document.body.classList.contains('theme-aurora')).toBe(true);
  });

  it('initializes theme switcher UI and handles click interaction', () => {
    document.body.innerHTML = `
      <div id="themeSwitcherWrap">
        <button id="themeSwitcherBtn">
          <span id="themeBtnIcon"></span>
          <span id="themeBtnLabel"></span>
        </button>
        <div id="themeDropdown">
          <button data-theme="aurora" class="opt">Aurora</button>
          <button data-theme="cyber" class="opt">Cyber</button>
          <button data-theme="linear" class="opt">Linear</button>
          <button data-theme="nordic" class="opt">Nordic</button>
        </div>
      </div>
    `;

    const container = document.getElementById('themeSwitcherWrap');
    initThemeSwitcher(container);

    const btn = document.getElementById('themeSwitcherBtn');
    const dropdown = document.getElementById('themeDropdown');
    const cyberOpt = container.querySelector('[data-theme="cyber"]');

    // Click trigger to open dropdown
    btn.click();
    expect(dropdown.classList.contains('open')).toBe(true);

    // Select cyber theme
    cyberOpt.click();
    expect(dropdown.classList.contains('open')).toBe(false);
    expect(document.body.dataset.theme).toBe('cyber');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('cyber');
    expect(document.getElementById('themeBtnIcon').textContent).toBe('⚡');
  });
});
