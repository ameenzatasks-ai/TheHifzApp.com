/**
 * SettingsPage — App settings hub.
 *
 * Sections:
 *   1. Theme     — Dark / Light toggle
 *   2. How It Works — Quick-start guide, tour and feature notes
 *   3. General   — Miscellaneous preferences
 *   4. Account   — Profile info + sign out
 *   5. About     — Version and what's new
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings, Sun, Moon, Map, Info,
  LogOut, User, ChevronRight, BookOpen, Star,
  Grid3x3, Clock, Bell, BellOff,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTour } from '../contexts/TourContext';
import BottomSheet from '../components/BottomSheet';
import { CHANGELOG } from '../lib/changelog';

/* ── Section wrapper ── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h2 className="text-[10px] font-bold uppercase tracking-wider mb-2 px-1" style={{ color: 'var(--c-text-muted)' }}>
        {title}
      </h2>
      <div className="rounded-2xl overflow-hidden divide-y" style={{ backgroundColor: 'var(--c-bg-card)', borderColor: 'var(--c-border)' }}>
        {children}
      </div>
    </div>
  );
}

/* ── Single setting row ── */
function SettingRow({ icon, label, description, right, onClick }: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  right?: React.ReactNode;
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left ${onClick ? 'transition-all active:scale-[0.98]' : ''}`}
      style={{ borderColor: 'var(--c-border)' }}
    >
      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: 'var(--c-bg-subtle)' }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: 'var(--c-text)' }}>{label}</p>
        {description && (
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--c-text-muted)' }}>{description}</p>
        )}
      </div>
      {right}
    </Tag>
  );
}

/* ── Toggle pill ── */
function TogglePill({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onToggle(); }}
      className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
      style={{ backgroundColor: active ? 'var(--c-green-dark)' : 'var(--c-border)' }}
    >
      <div
        className="absolute top-0.5 w-5 h-5 rounded-full transition-transform shadow-sm"
        style={{
          backgroundColor: '#FFF',
          transform: active ? 'translateX(22px)' : 'translateX(2px)',
        }}
      />
    </button>
  );
}

/* ── App features (tapping a card opens its explanation) ── */
interface FeatureInfo {
  icon: React.ReactNode;
  title: string;
  summary: string;
  details: string[];
  points?: { label: string; text?: string }[];
}

const FEATURES: FeatureInfo[] = [
  {
    icon: <BookOpen className="w-3.5 h-3.5" style={{ color: '#0E9C78' }} />,
    title: 'Nazirah Tracking',
    summary: 'Track page statuses across 604 pages with colour-coded progress.',
    details: [
      'Nazirah is reading the Qur\'an while looking at the Mushaf. This tracker shows every page, grouped by Juz, so you can see where you are.',
      'Tap a page to choose its status. When you choose Ready for Test 1, a headphones button next to it plays the recitation.',
      'A page that stays Ready to Memorize for ten days turns into Retest Needed on its own.',
    ],
    points: [
      { label: 'Ready for Test 1', text: 'You have listened to the page once and checked the Tajweed rules.' },
      { label: 'Test 1 Passed', text: 'You are practising the page, with tests in between, before the final test.' },
      { label: 'Ready for Final Test', text: 'You have finished the practice and are waiting for your Ustadh to test you.' },
      { label: 'Ready to Memorize', text: 'Your Ustadh has tested you for a final time, and you can memorise the page when you are ready.' },
      { label: 'Retest Needed', text: 'Ten days have passed since the final test, so the page needs testing again.' },
      { label: 'Memorized', text: 'The page is memorised in Sabaq.' },
    ],
  },
  {
    icon: <Star className="w-3.5 h-3.5" style={{ color: '#FFD700' }} />,
    title: 'Hifz Module',
    summary: 'Log daily Sabaq, Sabaq Para, and Dawr. Ustadh scores each session 1-7.',
    details: [
      'Hifz is complete memorisation of the Qur\'an. From the Home screen, log what you did today.',
      'Your Ustadh gives each session a score from 1 to 7, and you can see every score in History.',
    ],
    points: [
      { label: 'Sabaq', text: 'Your daily new lesson: the pages you memorise fresh today.' },
      { label: 'Sabaq Para', text: 'Recent review: revising the pages you have learned lately.' },
      { label: 'Dawr', text: 'Revision of recently memorised pages.' },
    ],
  },
  {
    icon: <Grid3x3 className="w-3.5 h-3.5" style={{ color: '#FF7A1A' }} />,
    title: 'Dawr Log',
    summary: '30 Juz x 4 quarters grid. Each quarter is scored individually.',
    details: [
      'The Dawr Log is a grid of all 30 Juz, and each Juz is split into four quarters.',
      'Your Ustadh scores each quarter separately, and each quarter is coloured by its score.',
    ],
  },
  {
    icon: <Clock className="w-3.5 h-3.5" style={{ color: '#B8862A' }} />,
    title: 'History',
    summary: 'Split into Nazira and Hifz history. View all past logs and scores.',
    details: [
      'History keeps a record of your past work, so you can look back over earlier weeks.',
    ],
    points: [
      { label: 'Nazira', text: 'Your saved weekly logs of the pages you tracked.' },
      { label: 'Hifz', text: 'Each Sabaq, Sabaq Para and Dawr you logged, by date, with the score your Ustadh gave.' },
    ],
  },
  {
    icon: <Info className="w-3.5 h-3.5" style={{ color: '#00B0F0' }} />,
    title: 'Score Scale',
    summary: '7 = Excellent, 6 = Very Good, 5 = Average, 4 = Below Avg, 3 = Fail, 2 = Bad Fail, 1 = Abysmal.',
    details: [
      'Your Ustadh gives each Hifz session one of these scores.',
    ],
    points: [
      { label: '7 · Excellent' },
      { label: '6 · Very Good' },
      { label: '5 · Average' },
      { label: '4 · Below Average' },
      { label: '3 · Fail' },
      { label: '2 · Bad Fail' },
      { label: '1 · Abysmal' },
    ],
  },
];

/* ── Main ── */
export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const { open: openTour } = useTour();
  const isDark = theme === 'dark';

  // Notification preference (local-only for now)
  const [notifs, setNotifs] = useState<boolean>(() => {
    try { return localStorage.getItem('hifz-notifs') !== 'off'; } catch { return true; }
  });
  function toggleNotifs() {
    const next = !notifs;
    setNotifs(next);
    try { localStorage.setItem('hifz-notifs', next ? 'on' : 'off'); } catch {}
    toast.success(next ? 'Notifications enabled' : 'Notifications muted');
  }

  // Feature explanation and "What's new" sheets
  const [openFeature, setOpenFeature] = useState<FeatureInfo | null>(null);
  const [showWhatsNew, setShowWhatsNew] = useState(false);

  async function handleLogout() {
    await logout();
    navigate('/welcome', { replace: true });
    toast.success('Signed out');
  }

  if (!user) return null;

  const initial = user.name[0]?.toUpperCase();

  return (
    <div className="min-h-screen pb-layout pt-safe" style={{ backgroundColor: 'var(--c-bg)' }}>
      <div className="p-5 max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: 'var(--c-gold-bg)' }}>
            <Settings className="w-5 h-5" style={{ color: 'var(--c-gold)' }} />
          </div>
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--c-text)' }}>Settings</h1>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--c-text-muted)' }}>
              Customise your experience
            </p>
          </div>
        </div>

        {/* ── Theme ── */}
        <Section title="Theme">
          <SettingRow
            icon={isDark ? <Moon className="w-4 h-4" style={{ color: 'var(--c-gold)' }} /> : <Sun className="w-4 h-4" style={{ color: 'var(--c-gold)' }} />}
            label={isDark ? 'Dark Mode' : 'Light Mode'}
            description={isDark ? 'Dark green background, easier on the eyes' : 'Cream-toned classic look'}
            right={<TogglePill active={isDark} onToggle={toggleTheme} />}
          />
        </Section>

        {/* ── How It Works ── */}
        <Section title="How It Works">
          <SettingRow
            icon={<Map className="w-4 h-4" style={{ color: 'var(--c-gold)' }} />}
            label="Take a Tour"
            description="Quick walkthrough of the app"
            right={<ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--c-text-faint)' }} />}
            onClick={openTour}
          />

          {/* Feature guide cards: tap one to read more */}
          <div className="px-4 py-3" style={{ borderColor: 'var(--c-border)' }}>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--c-text-muted)' }}>
              App Features
            </p>
            <div className="flex flex-col gap-2">
              {FEATURES.map(feat => (
                <button
                  key={feat.title}
                  type="button"
                  onClick={() => setOpenFeature(feat)}
                  className="w-full flex items-start gap-2.5 p-2.5 rounded-xl text-left transition-all active:scale-[0.98]"
                  style={{ backgroundColor: 'var(--c-bg-subtle)' }}
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: 'var(--c-bg-card)', border: '1px solid var(--c-border)' }}>
                    {feat.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold" style={{ color: 'var(--c-text)' }}>{feat.title}</p>
                    <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: 'var(--c-text-muted)' }}>{feat.summary}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 flex-shrink-0 mt-1" style={{ color: 'var(--c-text-faint)' }} />
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* ── General ── */}
        <Section title="General">
          <SettingRow
            icon={notifs
              ? <Bell className="w-4 h-4" style={{ color: 'var(--c-gold)' }} />
              : <BellOff className="w-4 h-4" style={{ color: 'var(--c-text-faint)' }} />}
            label="Notifications"
            description={notifs ? 'Toast notifications are enabled' : 'Toast notifications are muted'}
            right={<TogglePill active={notifs} onToggle={toggleNotifs} />}
          />
        </Section>

        {/* ── Account ── */}
        <Section title="Account">
          <div className="px-4 py-4 flex items-center gap-3" style={{ borderColor: 'var(--c-border)' }}>
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.name} className="w-12 h-12 rounded-full object-cover flex-shrink-0" loading="lazy" />
            ) : (
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0"
                style={{ backgroundColor: 'var(--c-green-dark)', color: 'var(--c-gold)' }}
              >
                {initial}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--c-text)' }}>{user.name}</p>
              <p className="text-[11px] truncate" style={{ color: 'var(--c-text-muted)' }}>{user.email}</p>
              <p className="text-[10px] capitalize mt-0.5" style={{ color: 'var(--c-text-faint)' }}>
                {user.role === 'ustadh' ? 'Ustadh (Teacher)' : 'Student'} · Joined {new Date(user.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>
          <SettingRow
            icon={<User className="w-4 h-4" style={{ color: 'var(--c-gold)' }} />}
            label="View Profile"
            description="Full profile details"
            right={<ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--c-text-faint)' }} />}
            onClick={() => navigate('/profile')}
          />
        </Section>

        {/* ── About ── */}
        <Section title="About">
          <SettingRow
            icon={<Info className="w-4 h-4" style={{ color: 'var(--c-gold)' }} />}
            label="Version"
            description="See what is new in each update"
            right={
              <span className="flex items-center gap-2">
                <span className="text-lg font-bold" style={{ color: 'var(--c-text)' }}>{__APP_VERSION__}</span>
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--c-text-faint)' }} />
              </span>
            }
            onClick={() => setShowWhatsNew(true)}
          />
        </Section>

        {/* Sign out */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-medium text-sm border transition-all active:scale-95"
          style={{
            color: 'var(--c-red)',
            borderColor: 'var(--c-red-bg)',
            backgroundColor: 'var(--c-red-bg)',
          }}
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>

        {openFeature && (
          <BottomSheet open onClose={() => setOpenFeature(null)} title={openFeature.title}>
            <div className="px-5 py-4 flex flex-col gap-3">
              {openFeature.details.map((paragraph, i) => (
                <p key={i} className="text-sm leading-relaxed" style={{ color: 'var(--c-text)' }}>{paragraph}</p>
              ))}
              {openFeature.points && (
                <ul className="flex flex-col gap-2 mt-1">
                  {openFeature.points.map(point => (
                    <li
                      key={point.label}
                      className="px-3.5 py-3 rounded-xl"
                      style={{ backgroundColor: 'var(--c-bg-subtle)', border: '1px solid var(--c-border-soft)' }}
                    >
                      <p className="text-sm font-semibold" style={{ color: 'var(--c-text)' }}>{point.label}</p>
                      {point.text && (
                        <p className="text-xs leading-snug mt-0.5" style={{ color: 'var(--c-text-muted)' }}>{point.text}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </BottomSheet>
        )}

        {showWhatsNew && (
          <BottomSheet open onClose={() => setShowWhatsNew(false)} title="What's new">
            <div className="px-5 py-4 flex flex-col gap-6">
              {CHANGELOG.map(release => (
                <div key={release.version}>
                  <div className="flex items-baseline justify-between gap-3 mb-2">
                    <h3 className="text-lg font-bold" style={{ color: 'var(--c-text)' }}>Version {release.version}</h3>
                    <p className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>{release.date}</p>
                  </div>
                  {release.sections.map((section, i) => (
                    <div key={i} className="mb-3">
                      {section.heading && (
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--c-text-muted)' }}>
                          {section.heading}
                        </p>
                      )}
                      <ul className="flex flex-col gap-1.5 list-disc pl-5 text-sm" style={{ color: 'var(--c-text)' }}>
                        {section.items.map((item, j) => <li key={j}>{item}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </BottomSheet>
        )}
      </div>
    </div>
  );
}
