import { useState, useEffect } from 'react'

export const COLOR_SCHEMES = {
  amber: {
    name: 'Amber',
    accent: '#d4a843',
    accentHover: '#c49a38',
    dark: {
      bgPrimary: '#0d0d0d',
      bgSecondary: '#161616',
      bgCard: '#1c1c1c',
      bgInput: '#252525',
      textPrimary: '#e8e6e3',
      textSecondary: '#8a8785',
      border: '#2a2a2a',
    },
    light: {
      bgPrimary: '#fafaf8',
      bgSecondary: '#f2f1ef',
      bgCard: '#ffffff',
      bgInput: '#f2f1ef',
      textPrimary: '#1a1917',
      textSecondary: '#6b6966',
      border: '#e0dfdc',
    },
  },
  emerald: {
    name: 'Emerald',
    accent: '#34d399',
    accentHover: '#2ab882',
    dark: {
      bgPrimary: '#0a0f0d',
      bgSecondary: '#121a16',
      bgCard: '#18221c',
      bgInput: '#1f2d24',
      textPrimary: '#e2ebe6',
      textSecondary: '#7a9485',
      border: '#243029',
    },
    light: {
      bgPrimary: '#f7fdf9',
      bgSecondary: '#eef8f2',
      bgCard: '#ffffff',
      bgInput: '#eef8f2',
      textPrimary: '#14261b',
      textSecondary: '#537362',
      border: '#d4ead9',
    },
  },
  arctic: {
    name: 'Arctic',
    accent: '#60a5fa',
    accentHover: '#4b93e8',
    dark: {
      bgPrimary: '#0c1220',
      bgSecondary: '#111a2e',
      bgCard: '#162038',
      bgInput: '#1c2a44',
      textPrimary: '#dfe8f5',
      textSecondary: '#7a8da6',
      border: '#223350',
    },
    light: {
      bgPrimary: '#f5f9ff',
      bgSecondary: '#ebf2fd',
      bgCard: '#ffffff',
      bgInput: '#ebf2fd',
      textPrimary: '#14213a',
      textSecondary: '#5a6e87',
      border: '#d2dff0',
    },
  },
  rose: {
    name: 'Rose',
    accent: '#f472b6',
    accentHover: '#e05da1',
    dark: {
      bgPrimary: '#140a10',
      bgSecondary: '#1e1018',
      bgCard: '#261520',
      bgInput: '#301a28',
      textPrimary: '#f0e4ea',
      textSecondary: '#a0818f',
      border: '#3a2030',
    },
    light: {
      bgPrimary: '#fef5f9',
      bgSecondary: '#fcedf3',
      bgCard: '#ffffff',
      bgInput: '#fcedf3',
      textPrimary: '#2d1520',
      textSecondary: '#885a6d',
      border: '#f0d4e0',
    },
  },
  slate: {
    name: 'Slate',
    accent: '#a1a1aa',
    accentHover: '#8e8e96',
    dark: {
      bgPrimary: '#111111',
      bgSecondary: '#191919',
      bgCard: '#1f1f1f',
      bgInput: '#272727',
      textPrimary: '#e4e4e4',
      textSecondary: '#888888',
      border: '#2e2e2e',
    },
    light: {
      bgPrimary: '#f8f8f8',
      bgSecondary: '#f0f0f0',
      bgCard: '#ffffff',
      bgInput: '#f0f0f0',
      textPrimary: '#1a1a1a',
      textSecondary: '#666666',
      border: '#e0e0e0',
    },
  },
}

import { getUserId } from '../utils/auth'

function getStorageKey() { return `nexum-color-scheme-${getUserId() || 'default'}` }

function applyScheme(schemeId, isDark) {
  const scheme = COLOR_SCHEMES[schemeId]
  if (!scheme) return

  const root = document.documentElement
  const colors = isDark ? scheme.dark : scheme.light

  root.style.setProperty('--color-accent', scheme.accent)
  root.style.setProperty('--color-accent-hover', scheme.accentHover)
  root.style.setProperty('--color-bg-primary', colors.bgPrimary)
  root.style.setProperty('--color-bg-secondary', colors.bgSecondary)
  root.style.setProperty('--color-bg-card', colors.bgCard)
  root.style.setProperty('--color-bg-input', colors.bgInput)
  root.style.setProperty('--color-text-primary', colors.textPrimary)
  root.style.setProperty('--color-text-secondary', colors.textSecondary)
  root.style.setProperty('--color-border', colors.border)
}

export function useColorScheme(isDark) {
  const [schemeId, setSchemeId] = useState(() => {
    return localStorage.getItem(getStorageKey()) || 'amber'
  })

  useEffect(() => {
    applyScheme(schemeId, isDark)
    localStorage.setItem(getStorageKey(), schemeId)
  }, [schemeId, isDark])

  const setColorScheme = (id) => {
    if (COLOR_SCHEMES[id]) setSchemeId(id)
  }

  return { schemeId, setColorScheme }
}
