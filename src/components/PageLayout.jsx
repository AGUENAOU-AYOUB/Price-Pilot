import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
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
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header
        className={clsx(
          'sticky top-0 z-40 w-full border-b border-neutral-200 bg-white transition-shadow',
          hasScrolled ? 'shadow-md' : 'shadow-sm shadow-transparent',
        )}
      >
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Logo />
            <div className="hidden flex-col lg:flex">
              <span className="text-sm font-medium text-neutral-500">{t('header.welcomeBack')}</span>
              <span className="text-lg font-semibold text-neutral-900">{username}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <nav className="hidden items-center gap-2 lg:flex">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    clsx(
                      'rounded-full px-4 py-2 text-sm font-medium transition-all duration-150',
                      isActive
                        ? 'bg-primary-600 text-white shadow-sm shadow-primary-200'
                        : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900',
                    )
                  }
                >
                  {t(item.labelKey)}
                </NavLink>
              ))}
            </nav>
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="flex items-center gap-3 rounded-full border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 shadow-sm transition hover:border-primary-200 hover:shadow-md"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-base font-semibold text-primary-600">
                  {initials || 'AZ'}
                </span>
                <div className="hidden text-left sm:flex sm:flex-col sm:leading-tight">
                  <span className="font-semibold text-neutral-900">{username}</span>
                  <span className="text-sm text-neutral-500">Azor Jewelry Admin</span>
                </div>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className={clsx('h-5 w-5 text-neutral-500 transition-transform', menuOpen ? 'rotate-180' : '')}
                >
                  <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-3 w-56 rounded-xl border border-neutral-200 bg-white p-2 shadow-xl"
                >
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full justify-start px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
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
                    className="w-full justify-start px-3 py-2 text-sm text-error-500 hover:bg-error-50"
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
        <div className="block border-t border-neutral-100 bg-white px-4 pb-4 pt-2 lg:hidden">
          <div className="flex gap-2 overflow-x-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    'whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all',
                    isActive
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'border border-neutral-200 text-neutral-600 hover:border-primary-200 hover:text-neutral-900',
                  )
                }
              >
                {t(item.labelKey)}
              </NavLink>
            ))}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="space-y-8">{children}</div>
      </main>
    </div>
  );
}
