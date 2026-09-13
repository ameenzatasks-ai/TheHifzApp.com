/**
 * Hifz 6-colour palette — bright, saturated, neon-leaning fills.
 *
 *   BLACK  — Listened          (neon yellow)
 *   RED    — Test 1 completed  (neon blue)
 *   AMBER  — Practiced         (neon orange)
 *   GREEN  — Test 2 completed  (neon green)
 *   GOLD   — Memorised         (gold)
 *   YELLOW — Re-test needed    (grey)
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
  // ── Listened — neon red ───────────────────────────────────────────────
  BLACK: {
    label: 'Listened',
    description: "I've listened to this page at least once",
    fill:      '#FF2D2D',
    accent:    '#B01E1E',
    iconBg:    '#FF7070',
    iconColor: '#7A0000',
    text:      '#4A0000',
    textSoft:  'rgba(74,0,0,0.72)',
    icon: Headphones,
  },
  // ── Practiced — neon blue (swapped) ───────────────────────────────────────
  RED: {
    label: 'Practiced',
    description: "I've practiced it 18 times since my 1st test, and read to a senior as many times as instructed",
    fill:      '#00E1FF',
    accent:    '#0090A8',
    iconBg:    '#8AF0FF',
    iconColor: '#00525F',
    text:      '#002A33',
    textSoft:  'rgba(0,42,51,0.72)',
    icon: BookOpen,
  },
  // ── In Practice — neon orange (swapped) ────────────────────────────────────────────
  AMBER: {
    label: 'In Practice',
    description: "I've recited this page to the ustadh for the first test",
    fill:      '#FF6600',
    accent:    '#CC4400',
    iconBg:    '#FF9955',
    iconColor: '#7A2000',
    text:      '#3A1500',
    textSoft:  'rgba(58,21,0,0.75)',
    icon: Pencil,
  },
  // ── Test 2 completed — neon green ──────────────────────────────────────
  GREEN: {
    label: 'Test 2 completed',
    description: 'Second test passed — I can start memorising this page',
    fill:      '#00E64A',
    accent:    '#00942F',
    iconBg:    '#86F5AC',
    iconColor: '#00551E',
    text:      '#002E10',
    textSoft:  'rgba(0,46,16,0.72)',
    icon: CheckCircle2,
  },
  // ── Memorised — gold ───────────────────────────────────────────────────
  GOLD: {
    label: 'Memorised',
    description: 'Memorised in Sabaq',
    fill:      '#FFC72E',
    accent:    '#A8760B',
    iconBg:    '#FFE39B',
    iconColor: '#6B4E00',
    text:      '#2E2100',
    textSoft:  'rgba(46,33,0,0.75)',
    icon: Star,
  },
  // ── Re-test needed — grey ──────────────────────────────────────────────
  YELLOW: {
    label: 'Re-test needed',
    description: 'Ten days have passed since Test 2 — needs re-testing',
    fill:      '#BFC4CB',
    accent:    '#6F7883',
    iconBg:    '#E1E5EA',
    iconColor: '#3A414B',
    text:      '#23272D',
    textSoft:  'rgba(35,39,45,0.75)',
    icon: RotateCw,
  },
};

export const ALL_STATUSES: PageStatus[] = [
  'BLACK', 'RED', 'AMBER', 'GREEN', 'GOLD', 'YELLOW',
];

export const PROGRESSION: PageStatus[] = ['BLACK', 'RED', 'AMBER', 'GREEN', 'GOLD'];
