import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';

import { usePricingStore } from '../store/pricingStore';
import { useTranslation } from '../i18n/useTranslation';
import { Logo } from './Logo';
import { Button } from './Button';

const PageLayoutContext = createContext({
  searchQuery: '',
  setSearchQuery: () => {},
});

export function usePageLayoutContext() {
  return useContext(PageLayoutContext);
}

const defaultMeta = {
  title: 'Workspace',
  breadcrumbs: ['Workspace'],
  primaryActionLabel: 'New action',
};

const topBarConfig = {
  '/': {
    title: 'Dashboard Overview',
    breadcrumbs: ['Dashboard'],
    primaryActionLabel: 'New automation',
  },
  '/global-pricing': {
    title: 'Global Pricing Rules',
    breadcrumbs: ['Pricing', 'Global Pricing'],
    primaryActionLabel: 'Create rule',
  },
  '/bracelets': {
    title: 'Bracelets Pricing',
    breadcrumbs: ['Pricing Management', 'Bracelets'],
    primaryActionLabel: 'New adjustment',
  },
  '/necklaces': {
    title: 'Necklaces Pricing',
    breadcrumbs: ['Pricing Management', 'Necklaces'],
    primaryActionLabel: 'New adjustment',
  },
  '/rings': {
    title: 'Rings Pricing',
    breadcrumbs: ['Pricing Management', 'Rings'],
    primaryActionLabel: 'New adjustment',
  },
  '/hand-chains': {
    title: 'Hand Chains Pricing',
    breadcrumbs: ['Pricing Management', 'Hand Chains'],
    primaryActionLabel: 'New adjustment',
  },
  '/sets': {
    title: 'Sets Pricing',
    breadcrumbs: ['Pricing Management', 'Sets'],
    primaryActionLabel: 'New adjustment',
  },
};

const toneClasses = {
  neutral: 'bg-slate-100 text-slate-600 border border-slate-200',
  warning: 'bg-amber-100 text-amber-600 border border-amber-200',
  success: 'bg-emerald-100 text-emerald-600 border border-emerald-200',
  info: 'bg-indigo-100 text-indigo-600 border border-indigo-200',
};

function Badge({ tone = 'neutral', children }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide',
        toneClasses[tone] ?? toneClasses.neutral,
      )}
    >
      {children}
    </span>
  );
}

function IconWrapper({ children }) {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition group-hover:bg-indigo-50 group-hover:text-indigo-600 group-focus-visible:bg-indigo-50 group-focus-visible:text-indigo-600">
      {children}
    </span>
  );
}

function NavigationItem({ item, collapsed, onSelect }) {
  const content = (
    <>
      <IconWrapper>
        <item.icon className="h-5 w-5" />
      </IconWrapper>
      {!collapsed && (
        <div className="flex flex-1 items-center justify-between gap-2">
          <span className="text-sm font-medium">{item.label}</span>
          {item.badge ? <Badge tone={item.badge.tone}>{item.badge.label}</Badge> : null}
        </div>
      )}
    </>
  );

  if (item.to) {
    return (
      <NavLink
        to={item.to}
        className={({ isActive }) =>
          clsx(
            'group flex items-center gap-3 rounded-xl px-3 py-2 text-slate-600 transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
            collapsed ? 'justify-center' : 'justify-start',
            isActive
              ? 'bg-indigo-100 text-indigo-700 shadow-sm'
              : 'hover:bg-slate-100 hover:text-indigo-700',
          )
        }
        onClick={onSelect}
      >
        {content}
      </NavLink>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (typeof item.onClick === 'function') {
          item.onClick();
        }
      }}
      className={clsx(
        'group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-slate-600 transition duration-200 hover:bg-slate-100 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
        collapsed ? 'justify-center' : 'justify-start',
      )}
    >
      {content}
    </button>
  );
}

function HomeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={clsx('h-5 w-5', props.className)}>
      <path d="M3 11.25L12 3l9 8.25V20a1 1 0 01-1 1h-5.5a.5.5 0 01-.5-.5v-4.75a.75.75 0 00-.75-.75h-3.5a.75.75 0 00-.75.75V20.5a.5.5 0 01-.5.5H4a1 1 0 01-1-1v-8.75z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CubeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={clsx('h-5 w-5', props.className)}>
      <path d="M12 3l8.5 4.5v9L12 21l-8.5-4.5v-9z" strokeLinejoin="round" />
      <path d="M12 12l8.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 12L3.5 7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AdjustmentsIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={clsx('h-5 w-5', props.className)}>
      <path d="M6 7h12M6 12h7M6 17h10" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="14" cy="17" r="2" />
    </svg>
  );
}

function CollectionIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={clsx('h-5 w-5', props.className)}>
      <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
      <path d="M9 4v16" />
      <path d="M4 9h16" />
    </svg>
  );
}

function BraceletIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={clsx('h-5 w-5', props.className)}>
      <circle cx="12" cy="12" r="7" />
      <path d="M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function NecklaceIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={clsx('h-5 w-5', props.className)}>
      <path d="M4 6c2 4 5 6 8 6s6-2 8-6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 12v8" strokeLinecap="round" />
      <path d="M8 20h8" strokeLinecap="round" />
    </svg>
  );
}

function RingIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={clsx('h-5 w-5', props.className)}>
      <circle cx="12" cy="14" r="6" />
      <path d="M9 5l3-3 3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LayersIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={clsx('h-5 w-5', props.className)}>
      <path d="M12 4l8 4-8 4-8-4 8-4z" strokeLinejoin="round" />
      <path d="M4 12l8 4 8-4" strokeLinejoin="round" />
      <path d="M4 16l8 4 8-4" strokeLinejoin="round" />
    </svg>
  );
}

function LinkIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={clsx('h-5 w-5', props.className)}>
      <path d="M10.5 13.5l3-3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 6h-2a4 4 0 000 8h2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 10h2a4 4 0 110 8h-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GlobeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={clsx('h-5 w-5', props.className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a15 15 0 010 18a15 15 0 010-18z" />
    </svg>
  );
}

function CogIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={clsx('h-5 w-5', props.className)}>
      <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h.09A1.65 1.65 0 0010 3.09V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51h.09a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v.09A1.65 1.65 0 0019.4 12z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShieldIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={clsx('h-5 w-5', props.className)}>
      <path d="M12 3l8 4v5c0 5.25-3.438 9.984-8 11-4.562-1.016-8-5.75-8-11V7l8-4z" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowLeftIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={clsx('h-5 w-5', props.className)}>
      <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MenuIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={clsx('h-6 w-6', props.className)}>
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function QuestionIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={clsx('h-5 w-5', props.className)}>
      <path d="M12 18h.01" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 14a4 4 0 10-4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlusIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={clsx('h-5 w-5', props.className)}>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CogSixIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={clsx('h-5 w-5', props.className)}>
      <path d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" />
      <path d="M19.94 13.5a7.5 7.5 0 000-3l-2.1-.35a5.5 5.5 0 00-.94-1.63l1.08-1.9a7.5 7.5 0 00-2.12-2.12l-1.9 1.08a5.5 5.5 0 00-1.63-.94l-.35-2.1a7.5 7.5 0 00-3 0l-.35 2.1a5.5 5.5 0 00-1.63.94l-1.9-1.08a7.5 7.5 0 00-2.12 2.12l1.08 1.9a5.5 5.5 0 00-.94 1.63l-2.1.35a7.5 7.5 0 000 3l2.1.35a5.5 5.5 0 00.94 1.63l-1.08 1.9a7.5 7.5 0 002.12 2.12l1.9-1.08a5.5 5.5 0 001.63.94l.35 2.1a7.5 7.5 0 003 0l.35-2.1a5.5 5.5 0 001.63-.94l1.9 1.08a7.5 7.5 0 002.12-2.12l-1.08-1.9a5.5 5.5 0 00.94-1.63l2.1-.35z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PageLayout({ children }) {
  const username = usePricingStore((state) => state.username);
  const setUsername = usePricingStore((state) => state.setUsername);
  const language = usePricingStore((state) => state.language);
  const setLanguage = usePricingStore((state) => state.setLanguage);
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const profileRef = useRef(null);
  const shortcutsRef = useRef(null);
  const commandPaletteRef = useRef(null);

  const pageMeta = useMemo(() => topBarConfig[location.pathname] ?? defaultMeta, [location.pathname]);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClick = (event) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target)
      ) {
        setIsProfileMenuOpen(false);
      }
      if (shortcutsRef.current && !shortcutsRef.current.contains(event.target)) {
        setShowShortcuts(false);
      }
      if (commandPaletteRef.current && !commandPaletteRef.current.contains(event.target)) {
        setShowCommandPalette(false);
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const initials = username
    ?.split(' ')
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
    .slice(0, 2);

  const email = username
    ? `${username.replace(/\s+/g, '.').toLowerCase()}@azorjewelry.com`
    : 'operations@azorjewelry.com';

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'fr' : 'en');
  };

  const openQuickActions = () => setShowCommandPalette(true);

  const navigationGroups = useMemo(
    () => [
      {
        key: 'main',
        title: 'Main',
        items: [
          { to: '/', label: t('nav.dashboard'), icon: HomeIcon },
          {
            label: 'Products',
            icon: CubeIcon,
            badge: { label: '3', tone: 'warning' },
            onClick: openQuickActions,
          },
          {
            to: '/global-pricing',
            label: 'Pricing Rules',
            icon: AdjustmentsIcon,
          },
          {
            label: 'Collections',
            icon: CollectionIcon,
            badge: { label: 'New', tone: 'info' },
            onClick: openQuickActions,
          },
        ],
      },
      {
        key: 'pricing',
        title: 'Pricing Management',
        items: [
          { to: '/hand-chains', label: t('nav.handChains'), icon: LinkIcon },
          { to: '/bracelets', label: t('nav.bracelets'), icon: BraceletIcon },
          { to: '/necklaces', label: t('nav.necklaces'), icon: NecklaceIcon },
          { to: '/rings', label: t('nav.rings'), icon: RingIcon },
          { to: '/sets', label: t('nav.sets'), icon: LayersIcon },
        ],
      },
      {
        key: 'settings',
        title: 'Settings',
        items: [
          {
            to: '/global-pricing',
            label: 'Global Pricing',
            icon: GlobeIcon,
            badge: { label: 'Live', tone: 'success' },
          },
          {
            label: 'Metafield Configuration',
            icon: CogIcon,
            onClick: openQuickActions,
          },
          {
            label: 'Backup & Restore',
            icon: ShieldIcon,
            onClick: openQuickActions,
          },
        ],
      },
    ],
    [openQuickActions, t],
  );

  const sidebarClassName = clsx(
    'fixed inset-y-0 left-0 z-40 flex h-full flex-col border-r border-slate-200 bg-white/90 text-slate-700 shadow-[0_18px_60px_-35px_rgba(15,23,42,0.55)] backdrop-blur-xl transition-transform duration-300 supports-[backdrop-filter]:bg-white/70',
    isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
    isCollapsed ? 'w-20' : 'w-72',
  );

  const mainClassName = clsx(
    'flex min-h-screen flex-col bg-slate-50 text-slate-900 transition-all duration-300',
    isCollapsed ? 'lg:ml-20' : 'lg:ml-72',
  );

  return (
    <PageLayoutContext.Provider value={{ searchQuery, setSearchQuery }}>
      <div className="relative flex min-h-screen bg-slate-50 text-slate-900">
        <aside className={sidebarClassName}>
          <div className="flex items-center justify-between px-4 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-indigo-100 text-indigo-700">
                <Logo />
              </div>
              {!isCollapsed && (
                <div className="leading-tight">
                  <p className="text-sm font-semibold tracking-tight text-slate-900">Price Pilot</p>
                  <p className="text-xs text-slate-400">Growth CRM</p>
                </div>
              )}
            </div>
            <button
              type="button"
              className="hidden rounded-lg border border-slate-200 p-2 text-slate-500 transition duration-200 hover:border-indigo-300 hover:text-indigo-600 lg:inline-flex"
              onClick={() => setIsCollapsed((current) => !current)}
            >
              <ArrowLeftIcon className={clsx('h-4 w-4 transition-transform', isCollapsed ? 'rotate-180' : '')} />
              <span className="sr-only">Toggle sidebar</span>
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-4 pb-6">
            <div className="space-y-6">
              {navigationGroups.map((group) => (
                <div key={group.key} className="space-y-3">
                  {!isCollapsed && (
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                      {group.title}
                    </p>
                  )}
                  <div className="space-y-1">
                    {group.items.map((item) => (
                      <NavigationItem
                        key={item.label}
                        item={item}
                        collapsed={isCollapsed}
                        onSelect={() => setIsSidebarOpen(false)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </nav>

          <div className="mt-auto border-t border-slate-200 px-4 py-5">
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                className={clsx(
                  'flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-left transition duration-200 hover:border-indigo-300 hover:bg-indigo-50',
                  isCollapsed ? 'justify-center' : 'justify-between',
                )}
                onClick={() => setIsProfileMenuOpen((current) => !current)}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500 text-sm font-semibold text-white">
                  {initials || 'PP'}
                </span>
                {!isCollapsed && (
                  <div className="flex flex-1 flex-col overflow-hidden">
                    <span className="truncate text-sm font-semibold text-slate-900">{username}</span>
                    <span className="truncate text-xs text-slate-400">{email}</span>
                  </div>
                )}
                {!isCollapsed && <CogSixIcon className="h-4 w-4 text-slate-400" />}
              </button>
              {isProfileMenuOpen && (
                <div className="absolute bottom-16 left-0 right-0 z-10 space-y-2 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600 shadow-xl">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 transition duration-200 hover:bg-slate-100"
                    onClick={() => {
                      setShowShortcuts(true);
                      setIsProfileMenuOpen(false);
                    }}
                  >
                    <span className="text-slate-700">View keyboard shortcuts</span>
                    <span className="text-xs text-slate-400">Shift + ?</span>
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 transition duration-200 hover:bg-slate-100"
                    onClick={() => {
                      toggleLanguage();
                      setIsProfileMenuOpen(false);
                    }}
                  >
                    <span>{language === 'en' ? 'Passer en français' : 'Switch to English'}</span>
                    <span className="text-xs text-slate-400">Alt + L</span>
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-rose-500 transition duration-200 hover:bg-rose-50"
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      setUsername(null);
                    }}
                  >
                    <span>{t('action.logout')}</span>
                    <span className="text-xs text-rose-300">Esc</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>

        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-slate-900/30 backdrop-blur-sm lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        <div className={mainClassName}>
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60">
            <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:px-10">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3 md:gap-4">
                  <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition duration-200 hover:border-indigo-300 hover:text-indigo-600 lg:hidden"
                    onClick={() => setIsSidebarOpen(true)}
                  >
                    <MenuIcon />
                    <span className="sr-only">Open navigation</span>
                  </button>
                  <button
                    type="button"
                    className="hidden h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition duration-200 hover:border-indigo-300 hover:text-indigo-600 lg:inline-flex"
                    onClick={() => navigate(-1)}
                  >
                    <ArrowLeftIcon />
                    <span className="sr-only">Go back</span>
                  </button>
                  <div className="min-w-0 space-y-1">
                    <nav className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-400">
                      {pageMeta.breadcrumbs.map((crumb, index) => (
                        <span key={crumb} className="flex items-center gap-2">
                          <span>{crumb}</span>
                          {index < pageMeta.breadcrumbs.length - 1 && (
                            <span aria-hidden="true" className="text-slate-300">
                              /
                            </span>
                          )}
                        </span>
                      ))}
                    </nav>
                    <h1 className="truncate text-xl font-semibold text-slate-900 sm:text-2xl">
                      {pageMeta.title}
                    </h1>
                  </div>
                </div>
                <div className="relative flex flex-wrap items-center justify-end gap-2 md:gap-3">
                  <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm transition duration-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 md:flex">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="h-4 w-4 text-slate-400"
                      aria-hidden="true"
                    >
                      <path d="M11 17a6 6 0 100-12 6 6 0 000 12z" />
                      <path d="M21 21l-3.5-3.5" strokeLinecap="round" />
                    </svg>
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className="w-56 border-none bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                      placeholder="Search products or rules"
                    />
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition duration-200 hover:border-indigo-300 hover:text-indigo-600"
                    onClick={() => setShowShortcuts((current) => !current)}
                  >
                    <QuestionIcon />
                    <span className="sr-only">Keyboard shortcuts</span>
                  </button>
                  <Button
                    variant="primary"
                    className="hidden md:inline-flex"
                    icon={<PlusIcon className="h-4 w-4" />}
                    onClick={() => setShowCommandPalette((current) => !current)}
                  >
                    {pageMeta.primaryActionLabel}
                  </Button>
                  <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-indigo-500 bg-indigo-500 text-white transition duration-200 hover:bg-indigo-400 md:hidden"
                    onClick={() => setShowCommandPalette((current) => !current)}
                  >
                    <PlusIcon />
                    <span className="sr-only">Create action</span>
                  </button>

                  {showShortcuts && (
                    <div
                      ref={shortcutsRef}
                      className="absolute right-0 top-12 z-20 w-72 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-xl"
                    >
                      <h3 className="text-sm font-semibold text-slate-900">Keyboard shortcuts</h3>
                      <ul className="mt-3 space-y-2">
                        <li className="flex items-center justify-between">
                          <span>Open quick actions</span>
                          <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs">Shift + A</span>
                        </li>
                        <li className="flex items-center justify-between">
                          <span>Toggle language</span>
                          <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs">Alt + L</span>
                        </li>
                        <li className="flex items-center justify-between">
                          <span>Preview pricing</span>
                          <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs">P</span>
                        </li>
                      </ul>
                    </div>
                  )}

                  {showCommandPalette && (
                    <div
                      ref={commandPaletteRef}
                      className="absolute right-0 top-12 z-20 w-80 space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-xl"
                    >
                      <h3 className="text-sm font-semibold text-slate-900">Quick actions</h3>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 transition duration-200 hover:bg-slate-100"
                        onClick={() => setShowCommandPalette(false)}
                      >
                        <span>Create pricing rule</span>
                        <span className="text-xs text-slate-400">Shift + C</span>
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 transition duration-200 hover:bg-slate-100"
                        onClick={() => setShowCommandPalette(false)}
                      >
                        <span>Import pricing CSV</span>
                        <span className="text-xs text-slate-400">I</span>
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 transition duration-200 hover:bg-slate-100"
                        onClick={() => setShowCommandPalette(false)}
                      >
                        <span>Export current rules</span>
                        <span className="text-xs text-slate-400">E</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="md:hidden">
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm transition duration-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="h-4 w-4 text-slate-400"
                    aria-hidden="true"
                  >
                    <path d="M11 17a6 6 0 100-12 6 6 0 000 12z" />
                    <path d="M21 21l-3.5-3.5" strokeLinecap="round" />
                  </svg>
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="flex-1 border-none bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                    placeholder="Search products or rules"
                  />
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-8 sm:px-6 lg:px-10">
            <div className="mx-auto w-full max-w-7xl space-y-6">{children}</div>
          </main>
        </div>
      </div>
    </PageLayoutContext.Provider>
  );
}
