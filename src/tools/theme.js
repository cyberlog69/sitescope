// @ts-check
/**
 * SiteScope — Multi-Theme Switcher Module
 * Supports: Aurora Cosmic, Cyber Obsidian, Linear Minimalist, Nordic Frost
 */

export const THEME_STORAGE_KEY = 'sitescope_theme';
export const DEFAULT_THEME = 'aurora';

/**
 * @typedef {Object} ThemeDefinition
 * @property {string} id
 * @property {string} name
 * @property {string} icon
 * @property {string} desc
 * @property {string} themeColor
 */

/** @type {Record<string, ThemeDefinition>} */
export const AVAILABLE_THEMES = {
  aurora: {
    id: 'aurora',
    name: 'Aurora Cosmic',
    icon: '🌌',
    desc: 'Deep space & violet neon glass',
    themeColor: '#06080f',
  },
  cyber: {
    id: 'cyber',
    name: 'Cyber Obsidian',
    icon: '⚡',
    desc: 'Hacker terminal & matrix green',
    themeColor: '#06080b',
  },
  linear: {
    id: 'linear',
    name: 'Linear Minimal',
    icon: '🖤',
    desc: 'Refined charcoal developer dark',
    themeColor: '#090a0f',
  },
  nordic: {
    id: 'nordic',
    name: 'Nordic Frost',
    icon: '❄️',
    desc: 'High-contrast enterprise light',
    themeColor: '#f1f5f9',
  },
};

/**
 * Gets the current stored theme or returns default
 * @returns {string}
 */
export function getStoredTheme() {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored && Object.prototype.hasOwnProperty.call(AVAILABLE_THEMES, stored)) {
        return stored;
      }
    }
  } catch {
    // LocalStorage may be blocked
  }
  return DEFAULT_THEME;
}

/**
 * Applies a theme to the document and persists the preference
 * @param {string} themeId
 * @returns {string} The applied theme ID
 */
export function applyTheme(themeId) {
  const targetId = Object.prototype.hasOwnProperty.call(AVAILABLE_THEMES, themeId)
    ? themeId
    : DEFAULT_THEME;
  const theme = AVAILABLE_THEMES[targetId];

  if (typeof document !== 'undefined') {
    if (document.body) {
      document.body.dataset.theme = targetId;
      // Remove any existing theme classes
      Object.keys(AVAILABLE_THEMES).forEach((id) => {
        document.body.classList.remove(`theme-${id}`);
      });
      document.body.classList.add(`theme-${targetId}`);
    }

    // Update meta theme-color
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme.themeColor);
    }
  }

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, targetId);
    }
  } catch {
    // LocalStorage may be blocked
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('themechange', { detail: { theme: targetId } })
    );
  }

  return targetId;
}

/**
 * Initializes the Theme Switcher UI dropdown and event bindings
 * @param {HTMLElement|null} container - Container wrapping button and dropdown
 */
export function initThemeSwitcher(container) {
  if (!container) return;

  const triggerBtn = container.querySelector('#themeSwitcherBtn');
  const dropdown = container.querySelector('#themeDropdown');
  const iconSpan = container.querySelector('#themeBtnIcon');
  const labelSpan = container.querySelector('#themeBtnLabel');
  const options = container.querySelectorAll('[data-theme]');

  function updateUi(activeId) {
    const theme = AVAILABLE_THEMES[activeId] || AVAILABLE_THEMES[DEFAULT_THEME];
    if (iconSpan) iconSpan.textContent = theme.icon;
    if (labelSpan) labelSpan.textContent = theme.name.split(' ')[0];

    options.forEach((opt) => {
      const optTheme = opt.getAttribute('data-theme');
      opt.classList.toggle('active', optTheme === activeId);
    });
  }

  // Set initial state
  const currentTheme = getStoredTheme();
  applyTheme(currentTheme);
  updateUi(currentTheme);

  if (triggerBtn && dropdown) {
    triggerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });

    // Option click
    options.forEach((opt) => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const selectedTheme = opt.getAttribute('data-theme');
        if (selectedTheme) {
          applyTheme(selectedTheme);
          updateUi(selectedTheme);
        }
        dropdown.classList.remove('open');
      });
    });

    // Click outside to close
    document.addEventListener('click', (e) => {
      if (!container.contains(/** @type {Node} */ (e.target))) {
        dropdown.classList.remove('open');
      }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        dropdown.classList.remove('open');
      }
    });
  }
}
