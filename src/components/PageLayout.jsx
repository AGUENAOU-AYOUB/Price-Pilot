import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';

import { usePricingStore } from '../store/pricingStore';
import { useTranslation } from '../i18n/useTranslation';
import { Logo } from './Logo';
import { Button } from './Button';

const navItems = [
  { to: '/', labelKey: 'nav.dashboard' },
  { to: '/global-pricing', labelKey: 'nav.globalPricing' },
  { to: '/bracelets', labelKey: 'nav.bracelets' },
  { to: '/necklaces', labelKey: 'nav.necklaces' },
  { to: '/rings', labelKey: 'nav.rings' },
  { to: '/hand-chains', labelKey: 'nav.handChains' },
  { to: '/sets', labelKey: 'nav.sets' },
  { to: '/spec-sets', labelKey: 'nav.specSets' },
];

export function PageLayout({ children }) {
  const username = usePricingStore((state) => state.username);
  const setUsername = usePricingStore((state) => state.setUsername);
  const language = usePricingStore((state) => state.language);
  const setLanguage = usePricingStore((state) => state.setLanguage);
  const { t } = useTranslation();
  const [hasScrolled, setHasScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const location = useLocation();

  const isDashboard = location.pathname === '/';

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'fr' : 'en');
  };

  useEffect(() => {
    const onScroll = () => {
      setHasScrolled(window.scrollY > 4);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const handleClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-red-950 text-gray-100">
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-80 blur-3xl" aria-hidden="true">
          <div className="h-full w-full bg-[radial-gradient(circle_at_top,_rgba(239,68,68,0.25),_transparent_55%)]" />
        </div>
        <header
          className={clsx(
            'sticky top-6 z-40 rounded-2xl border border-white/10 bg-black/70 backdrop-blur-xl transition-all',
            hasScrolled ? 'shadow-2xl' : 'shadow-xl',
          )}
        >
          <div className="flex items-center justify-between px-6 py-5">
            <div className="flex items-center gap-5">
              <Logo />
              <div className="hidden flex-col lg:flex">
                <span className="text-xs font-medium uppercase tracking-[0.2em] text-gray-400">
                  {t('header.welcomeBack')}
                </span>
                <span className="text-lg font-semibold text-white">{username}</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {!isDashboard && (
                <nav className="hidden items-center gap-2 lg:flex">
                  {navItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        clsx(
                          'rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200',
                          isActive
                            ? 'bg-white text-black shadow-2xl'
                            : 'text-gray-300 hover:bg-white/10 hover:text-white',
                        )
                      }
                    >
                      {t(item.labelKey)}
                    </NavLink>
                  ))}
                </nav>
              )}
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((open) => !open)}
                  className="flex items-center gap-3 rounded-full border border-white/10 bg-black/60 px-3 py-2 text-sm font-medium text-gray-200 shadow-2xl transition hover:border-white/30 hover:bg-black/70"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-base font-semibold text-black shadow-lg">
                    {initials || 'AZ'}
                  </span>
                  <div className="hidden text-left sm:flex sm:flex-col sm:leading-tight">
                    <span className="font-semibold text-white">{username}</span>
                    <span className="text-xs uppercase tracking-[0.2em] text-gray-400">Azor Jewelry Admin</span>
                  </div>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className={clsx('h-5 w-5 text-gray-400 transition-transform', menuOpen ? 'rotate-180' : '')}
                  >
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-3 w-60 rounded-2xl border border-white/10 bg-black/90 p-3 text-sm text-gray-100 shadow-2xl backdrop-blur-xl"
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full justify-start px-3 py-2 text-gray-200 hover:bg-white/10"
                      onClick={() => {
                        toggleLanguage();
                        setMenuOpen(false);
                      }}
                    >
                      {language === 'en' ? 'Passer en Français' : 'Switch to English'}
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      className="mt-1 w-full justify-start px-3 py-2 text-red-300 hover:bg-red-500/20"
                      onClick={() => {
                        setMenuOpen(false);
                        setUsername(null);
                      }}
                    >
                      {t('action.logout')}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
          {!isDashboard && (
            <div className="block border-t border-white/5 bg-black/60 px-4 pb-4 pt-2 backdrop-blur-xl lg:hidden">
              <div className="flex gap-2 overflow-x-auto">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      clsx(
                        'whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all',
                        isActive
                          ? 'bg-white text-black shadow-2xl'
                          : 'border border-white/10 text-gray-300 hover:border-white/30 hover:text-white',
                      )
                    }
                  >
                    {t(item.labelKey)}
                  </NavLink>
                ))}
              </div>
            </div>
          )}
        </header>
        <main className="mt-10 flex-1">
          <div className="space-y-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
