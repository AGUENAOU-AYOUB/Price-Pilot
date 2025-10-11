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
    <div className="min-h-screen bg-gradient-to-br from-[#f8fafb] via-[#e5eaed] to-white text-[#1e2835]">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-36 left-1/3 h-96 w-96 rounded-full bg-[#c5d9e3]/40 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[420px] w-[420px] translate-x-1/4 translate-y-1/4 rounded-full bg-[#e8f2f7]/70 blur-3xl" />
      </div>
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-16 pt-8 sm:px-6 lg:px-10">
        <header
          className={clsx(
            'sticky top-8 z-40 rounded-3xl border border-[#d7e0e8] bg-white/95 backdrop-blur-xl transition-all',
            hasScrolled ? 'shadow-[0_20px_60px_-30px_rgba(26,58,74,0.45)]' : 'shadow-[0_12px_40px_-28px_rgba(26,58,74,0.35)]',
          )}
        >
          <div className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-5">
              <Logo />
              <div className="hidden flex-col lg:flex">
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-[#5a6c7d]">
                  {t('header.welcomeBack')}
                </span>
                <span className="text-lg font-semibold text-[#1e2835]">{username}</span>
              </div>
            </div>
            <div className="flex flex-1 items-center justify-between gap-4 lg:justify-end">
              {!isDashboard && (
                <nav className="hidden items-center gap-2 lg:flex">
                  {navItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        clsx(
                          'rounded-full px-4 py-2 text-sm font-medium text-[#5a6c7d] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a3a4a]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                          isActive
                            ? 'bg-[#e8f2f7] text-[#1a3a4a] shadow-[0_12px_30px_-20px_rgba(26,58,74,0.45)]'
                            : 'hover:bg-[#e8f2f7]/70 hover:text-[#1a3a4a]',
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
                  className="flex items-center gap-3 rounded-2xl border border-[#d7e0e8] bg-white/90 px-3 py-2 text-sm font-medium text-[#1e2835] shadow-[0_18px_40px_-25px_rgba(26,58,74,0.35)] transition hover:border-[#c2d3dd] hover:bg-white"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1a3a4a] text-base font-semibold text-white shadow-[0_8px_20px_-12px_rgba(26,58,74,0.6)]">
                    {initials || 'AZ'}
                  </span>
                  <div className="hidden text-left sm:flex sm:flex-col sm:leading-tight">
                    <span className="font-semibold text-[#1e2835]">{username}</span>
                    <span className="text-xs uppercase tracking-[0.3em] text-[#5a6c7d]">Azor Jewelry Admin</span>
                  </div>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className={clsx('h-5 w-5 text-[#5a6c7d] transition-transform', menuOpen ? 'rotate-180' : '')}
                  >
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-3 w-60 rounded-2xl border border-[#d7e0e8] bg-white/95 p-3 text-sm text-[#1e2835] shadow-[0_28px_60px_-30px_rgba(26,58,74,0.35)]"
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full justify-start px-3 py-2 text-[#1e2835] hover:bg-[#e8f2f7]"
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
                      className="mt-1 w-full justify-start px-3 py-2"
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
            <div className="block border-t border-[#e0e7ec] bg-white/80 px-4 pb-4 pt-2 backdrop-blur-lg lg:hidden">
              <div className="flex gap-2 overflow-x-auto">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      clsx(
                        'whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-[#5a6c7d] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a3a4a]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                        isActive
                          ? 'bg-[#e8f2f7] text-[#1a3a4a] shadow-[0_12px_30px_-20px_rgba(26,58,74,0.35)]'
                          : 'border border-[#d7e0e8] hover:bg-[#e8f2f7]/70 hover:text-[#1a3a4a]',
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
        <main className="mt-12 flex-1">
          <div className="space-y-12">{children}</div>
        </main>
      </div>
    </div>
  );
}
