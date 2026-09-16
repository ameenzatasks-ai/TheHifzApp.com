/**
 * Hifz 6-colour palette — bright, saturated, neon-leaning fills.
 *
 * Status progression:
 *   BLACK  — Ready for Test 1    (neon red)
 *   RED    — Test 1 Passed       (neon blue)
 *   AMBER  — Ready for Final Test (neon orange)
 *   GREEN  — Ready to Memorize   (neon green)
 *   GOLD   — Memorized           (gold)
 *   YELLOW — Retest Needed       (neutral gray)
 *
 * The keys are the original status codes and stay as they are: they are
 * written to the database and to every historic row, so renaming them would
 * mean migrating existing data for no gain. Only what the reader sees — the
 * label, description and colour — is defined here.
 *
 * Every fill is now light, so `text` is a dark tone rather than white and
 * `accent` is a DARKER shade of the fill (a lighter one would disappear
 * against it). `textSoft` is the same dark tone at reduced strength, for
 * secondary copy sitting on a fill.
 */
import type { PageStatus } from '../../../shared/juz-map';
import {
  Headphones, BookOpen, Pencil, CheckCircle2, Star, RotateCw,
  type LucideIcon,
} from 'lucide-react';

export interface PaletteEntry {
  label: string;
  description: string;
  fill: string;
  accent: string;
  iconBg: string;
  iconColor: string;
  text: string;
  /** Dimmed `text`, for secondary copy on top of `fill`. */
  textSoft: string;
  icon: LucideIcon;
}

export const PALETTE: Record<PageStatus, PaletteEntry> = {
  // ── Ready for Test 1 — neon red ───────────────────────────────────────
  BLACK: {
    label: 'Ready for Test 1',
    description: 'I have listened to this page once and checked the Tajweed rules.',
    fill:      '#FF2D2D',
    accent:    '#B01E1E',
    iconBg:    '#FF7070',
    iconColor: '#7A0000',
    text:      '#4A0000',
    textSoft:  'rgba(74,0,0,0.72)',
    icon: Headphones,
  },
  // ── Test 1 Passed — neon blue ───────────────────────────────────────────
  RED: {
    label: 'Test 1 Passed',
    description: 'I am now practising it 18 times, with tests in between, before taking my final test with the Ustadh.',
    fill:      '#00E1FF',
    accent:    '#0090A8',
    iconBg:    '#8AF0FF',
    iconColor: '#00525F',
    text:      '#002A33',
    textSoft:  'rgba(0,42,51,0.72)',
    icon: BookOpen,
  },
  // ── Ready for Final Test — neon orange ────────────────────────────────
  AMBER: {
    label: 'Ready for Final Test',
    description: 'I have completed the practice and am now waiting for the Ustadh to test me.',
    fill:      '#FF6600',
    accent:    '#CC4400',
    iconBg:    '#FF9955',
    iconColor: '#7A2000',
    text:      '#3A1500',
    textSoft:  'rgba(58,21,0,0.75)',
    icon: Pencil,
  },
  // ── Ready to Memorize — neon green ────────────────────────────────────
  GREEN: {
    label: 'Ready to Memorize',
    description: 'The Ustadh has tested me for a final time, and I can memorise this page when I am ready.',
    fill:      '#00E64A',
    accent:    '#00942F',
    iconBg:    '#86F5AC',
    iconColor: '#00551E',
    text:      '#002E10',
    textSoft:  'rgba(0,46,16,0.72)',
    icon: CheckCircle2,
  },
  // ── Memorized — gold ───────────────────────────────────────────────────
  GOLD: {
    label: 'Memorized',
    description: 'Memorized in Sabaq',
    fill:      '#FFC72E',
    accent:    '#A8760B',
    iconBg:    '#FFE39B',
    iconColor: '#6B4E00',
    text:      '#2E2100',
    textSoft:  'rgba(46,33,0,0.75)',
    icon: Star,
  },
  // ── Retest Needed — neutral gray ───────────────────────────────────────
  YELLOW: {
    label: 'Retest Needed',
    description: 'Ten days have passed since the final test — needs re-testing',
    fill:      '#9CA3AF',
    accent:    '#6B7280',
    iconBg:    '#D1D5DB',
    iconColor: '#374151',
    text:      '#1F2937',
    textSoft:  'rgba(31,41,55,0.75)',
    icon: RotateCw,
  },
};

export const ALL_STATUSES: PageStatus[] = [
  'BLACK', 'RED', 'AMBER', 'GREEN', 'GOLD', 'YELLOW',
];

export const PROGRESSION: PageStatus[] = ['BLACK', 'RED', 'AMBER', 'GREEN', 'GOLD'];
