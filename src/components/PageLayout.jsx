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
    <div className="relative min-h-screen bg-brand-cream text-brand-charcoal">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.16),_transparent_58%),_linear-gradient(180deg,_rgba(219,234,254,0.78)_0%,_rgba(248,250,252,0.92)_42%,_#f8fafc_100%)]" />
      <header
        className={clsx(
          'sticky top-0 z-40 w-full border-b border-neutral-200/70 bg-white/80 backdrop-blur-xl transition-all duration-200',
          hasScrolled ? 'shadow-[0_18px_48px_-28px_rgba(30,64,175,0.35)]' : 'shadow-none',
        )}
      >
        <div className="mx-auto flex w-full items-center justify-between px-4 py-4 sm:px-6 lg:px-12 xl:px-14">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 rounded-full bg-white/80 px-4 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] ring-1 ring-neutral-200/60">
              <Logo />
              <span className="hidden text-sm font-semibold uppercase tracking-[0.28em] text-neutral-500 sm:block">
                Azor Admin
              </span>
            </div>
            <div className="hidden flex-col lg:flex">
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-400">
                {t('header.welcomeBack')}
              </span>
              <span className="text-xl font-semibold text-brand-charcoal">{username}</span>
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
                        'rounded-full border border-transparent px-5 py-2 text-sm font-semibold transition-all duration-200',
                        'hover:-translate-y-[1px] hover:border-brand-rose/50 hover:bg-white/90 hover:text-brand-charcoal',
                        isActive
                          ? 'bg-primary-600 text-white shadow-[0_16px_38px_-24px_rgba(30,64,175,0.55)] hover:bg-primary-500'
                          : 'text-neutral-500'
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
                className="group flex items-center gap-3 rounded-full border border-neutral-200/70 bg-white/85 px-3 py-2 text-sm font-medium text-brand-charcoal shadow-[0_16px_40px_-26px_rgba(15,23,42,0.25)] transition hover:border-brand-rose/60 hover:shadow-[0_24px_50px_-28px_rgba(15,23,42,0.28)]"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-base font-semibold text-white shadow-inner shadow-primary-900/30">
                  {initials || 'AZ'}
                </span>
                <div className="hidden text-left sm:flex sm:flex-col sm:leading-tight">
                  <span className="font-semibold text-brand-charcoal">{username}</span>
                  <span className="text-xs font-medium uppercase tracking-[0.3em] text-neutral-400">
                    Azor Jewelry
                  </span>
                </div>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className={clsx('h-5 w-5 text-neutral-400 transition-transform', menuOpen ? 'rotate-180' : '')}
                >
                  <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-3 w-60 rounded-2xl border border-neutral-200/80 bg-white/95 p-3 text-sm text-brand-charcoal shadow-[0_28px_70px_-32px_rgba(15,23,42,0.32)] backdrop-blur-xl"
                >
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full justify-start rounded-xl px-4 py-2 text-sm font-medium text-brand-charcoal hover:bg-neutral-100"
                    onClick={() => {
                      toggleLanguage();
                      setMenuOpen(false);
                    }}
                  >
                    {language === 'en' ? 'Passer en Français' : 'Switch to English'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="mt-1 w-full justify-start rounded-xl px-4 py-2 text-sm font-medium text-error-500 hover:bg-error-50"
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
          <div className="block border-t border-neutral-200/70 bg-white/75 px-4 pb-4 pt-2 backdrop-blur-xl lg:hidden">
            <div className="flex gap-2 overflow-x-auto">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    clsx(
                      'whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200',
                      isActive
                        ? 'bg-primary-600 text-white shadow-[0_16px_32px_-22px_rgba(30,64,175,0.45)] hover:bg-primary-500'
                        : 'border border-neutral-200/70 text-neutral-500 hover:bg-neutral-100 hover:text-brand-charcoal',
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
      <main className="relative z-10 mx-auto w-full px-4 py-12 sm:px-6 lg:px-12 xl:px-14">
        <div className="space-y-10">
          {children}
        </div>
      </main>
    </div>
  );
}
