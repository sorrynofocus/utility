'use strict';

// Defines the built-in themes for the HTML report, including light, dark, and 
// high-contrast modes.
const themes = {
  light: {
    name: 'Light',
    bg: '#f7f8fb',
    panel: '#ffffff',
    panelAlt: '#f1f5f9',
    text: '#172033',
    muted: '#5b667a',
    border: '#d7dde8',
    accent: '#2563eb',
    accentAlt: '#0f766e',
    warning: '#a16207',
    danger: '#b91c1c',
    good: '#15803d',
  },
  dark: {
    name: 'Dark',
    bg: '#10131a',
    panel: '#171b24',
    panelAlt: '#202636',
    text: '#eef2f8',
    muted: '#a8b1c2',
    border: '#30384a',
    accent: '#60a5fa',
    accentAlt: '#2dd4bf',
    warning: '#fbbf24',
    danger: '#f87171',
    good: '#4ade80',
  },
  'high-contrast': {
    name: 'High contrast',
    bg: '#000000',
    panel: '#050505',
    panelAlt: '#111111',
    text: '#ffffff',
    muted: '#f5f5f5',
    border: '#ffffff',
    accent: '#00ffff',
    accentAlt: '#ffff00',
    warning: '#ffff00',
    danger: '#ff4d4d',
    good: '#66ff66',
  },
  seegson: {
    name: 'Seegson',
    bg: '#e3e7e6',
    panel: '#f2f4f4',
    panelAlt: '#d8dddc',
    text: '#1e2a28',
    muted: '#4a7a72',
    border: '#8aa9a3',
    accent: '#4a7a72',
    accentAlt: '#6a9a92',
    warning: '#8a6d2f',
    danger: '#9a4f4a',
    good: '#4a7a72',
  },
  'earl-kelly': {
    name: 'Earl Kelly',
    bg: '#f9f3e8',
    panel: '#fcf6ec',
    panelAlt: '#f4e8d6',
    text: '#2e241c',
    muted: '#6a503c',
    border: '#bc7a3f',
    accent: '#6b4a34',
    accentAlt: '#8c5a2b',
    warning: '#9a651f',
    danger: '#8c3f2b',
    good: '#5f6b34',
  },
};

// Converts the built-in theme token map into CSS custom-property blocks.
// Used by html-report.js inside renderHtmlReport() so the report stays self-contained.
function themeCss() {
  return Object.entries(themes).map(([id, theme]) => {
    const selector = id === 'light' ? ':root' : `:root[data-theme="${id}"]`;
    return `${selector}{--bg:${theme.bg};--panel:${theme.panel};--panel-alt:${theme.panelAlt};--text:${theme.text};--muted:${theme.muted};--border:${theme.border};--accent:${theme.accent};--accent-alt:${theme.accentAlt};--warning:${theme.warning};--danger:${theme.danger};--good:${theme.good};}`;
  }).join('\n');
}

module.exports = { themes, themeCss };