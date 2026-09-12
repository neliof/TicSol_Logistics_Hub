/**
 * TicSol Logistics Hub — Unified Design System
 * Colors, typography, and spacing system
 */

export const designSystem = {
  colors: {
    // Primary (Blue)
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb', // Primary action
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
    },
    // Secondary (Purple)
    secondary: {
      50: '#f3f0ff',
      100: '#ede9fe',
      200: '#ddd6fe',
      300: '#c4b5fd',
      400: '#a78bfa',
      500: '#a855f7',
      600: '#9333ea', // Secondary action
      700: '#7e22ce',
      800: '#6b21a8',
      900: '#581c87',
    },
    // Danger (Red/Rose)
    danger: {
      50: '#fff7ed',
      100: '#fee2e2',
      200: '#fecaca',
      300: '#fca5a5',
      400: '#f87171',
      500: '#ef4444',
      600: '#dc2626', // Danger action
      700: '#b91c1c',
      800: '#991b1b',
      900: '#7f1d1d',
    },
    // Success (Emerald)
    success: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e',
      600: '#16a34a', // Success state
      700: '#15803d',
      800: '#166534',
      900: '#145231',
    },
    // Warning (Amber)
    warning: {
      50: '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      300: '#fcd34d',
      400: '#fbbf24',
      500: '#f59e0b',
      600: '#d97706', // Warning state
      700: '#b45309',
      800: '#92400e',
      900: '#78350f',
    },
    // Neutral (Slate)
    neutral: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
    },
  },
  typography: {
    // Font families
    fontFamily: {
      sans: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      mono: 'ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, "DejaVu Sans Mono", monospace',
    },
    // Font sizes
    fontSize: {
      xs: ['0.75rem', { lineHeight: '1rem' }], // 12px
      sm: ['0.875rem', { lineHeight: '1.25rem' }], // 14px
      base: ['1rem', { lineHeight: '1.5rem' }], // 16px
      lg: ['1.125rem', { lineHeight: '1.75rem' }], // 18px
      xl: ['1.25rem', { lineHeight: '1.75rem' }], // 20px
      '2xl': ['1.5rem', { lineHeight: '2rem' }], // 24px
    },
    // Font weights
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  spacing: {
    // Base unit: 4px
    xs: '0.25rem', // 4px
    sm: '0.5rem', // 8px
    md: '1rem', // 16px
    lg: '1.5rem', // 24px
    xl: '2rem', // 32px
    '2xl': '3rem', // 48px
  },
  shadows: {
    xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },
  borderRadius: {
    none: '0',
    sm: '0.125rem', // 2px
    base: '0.25rem', // 4px
    md: '0.375rem', // 6px
    lg: '0.5rem', // 8px
    xl: '0.75rem', // 12px
  },
} as const;

// Semantic color aliases (context-specific)
export const semanticColors = {
  primary: designSystem.colors.primary[600], // Blue
  secondary: designSystem.colors.secondary[600], // Purple
  danger: designSystem.colors.danger[600], // Rose
  success: designSystem.colors.success[600], // Emerald
  warning: designSystem.colors.warning[600], // Amber
  background: designSystem.colors.neutral[50], // Off-white
  surface: designSystem.colors.neutral[900], // Dark for navbar
  text: designSystem.colors.neutral[900],
  textLight: designSystem.colors.neutral[400],
  border: designSystem.colors.neutral[200],
} as const;

export type DesignSystem = typeof designSystem;
export type SemanticColors = typeof semanticColors;
