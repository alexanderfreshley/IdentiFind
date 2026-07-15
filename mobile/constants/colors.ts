/**
 * Brand color palette — mirrors the IdentiFind web app (Tailwind slate/blue scale).
 */
export const Colors = {
  // Backgrounds
  bg:        '#0F172A',   // slate-900  — screen background
  surface:   '#1E293B',   // slate-800  — cards, modals
  border:    '#334155',   // slate-700  — dividers, input borders
  subtle:    '#475569',   // slate-600  — subtle separators

  // Text
  text:      '#F1F5F9',   // slate-100  — primary text
  textMuted: '#94A3B8',   // slate-400  — secondary / placeholder text
  textFaint: '#64748B',   // slate-500  — disabled / hint text

  // Accent
  accent:    '#3B82F6',   // blue-500   — primary CTA, links
  accentDim: '#1D4ED8',   // blue-700   — pressed state

  // Severity
  critical:  '#EF4444',   // red-500
  high:      '#F97316',   // orange-500
  medium:    '#EAB308',   // yellow-500
  low:       '#22C55E',   // green-500

  // Status
  success:   '#16A34A',
  warning:   '#D97706',
  error:     '#DC2626',

  // Tab bar
  tabActive:   '#3B82F6',
  tabInactive: '#64748B',
} as const;

export type SeverityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export const SeverityColors: Record<SeverityLevel, string> = {
  CRITICAL: Colors.critical,
  HIGH:     Colors.high,
  MEDIUM:   Colors.medium,
  LOW:      Colors.low,
};
