'use strict';

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
};

function themeCss() {
  return Object.entries(themes).map(([id, theme]) => {
    const selector = id === 'light' ? ':root' : `:root[data-theme="${id}"]`;
    return `${selector}{--bg:${theme.bg};--panel:${theme.panel};--panel-alt:${theme.panelAlt};--text:${theme.text};--muted:${theme.muted};--border:${theme.border};--accent:${theme.accent};--accent-alt:${theme.accentAlt};--warning:${theme.warning};--danger:${theme.danger};--good:${theme.good};}`;
  }).join('\n');
}

module.exports = { themes, themeCss };