import { PropsWithChildren } from 'react';
import { NavLink } from 'react-router-dom';

import { usePricingStore } from '../store/pricingStore';
import { useTranslation } from '../i18n/useTranslation';
import { Logo } from './Logo';
import { Button } from './Button';

const navItems = [
  { to: '/', labelKey: 'nav.dashboard' as const },
  { to: '/global-pricing', labelKey: 'nav.globalPricing' as const },
  { to: '/bracelets', labelKey: 'nav.bracelets' as const },
  { to: '/necklaces', labelKey: 'nav.necklaces' as const },
  { to: '/rings', labelKey: 'nav.rings' as const },
  { to: '/hand-chains', labelKey: 'nav.handChains' as const },
  { to: '/sets', labelKey: 'nav.sets' as const },
];

export function PageLayout({ children }: PropsWithChildren) {
  const username = usePricingStore((state) => state.username);
  const setUsername = usePricingStore((state) => state.setUsername);
  const language = usePricingStore((state) => state.language);
  const setLanguage = usePricingStore((state) => state.setLanguage);
  const { t } = useTranslation();

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'fr' : 'en');
  };

  return (
    <div className="min-h-screen bg-pearl">
      <header className="border-b border-platinum bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Logo />
            <div className="flex flex-col">
              <span className="text-sm text-slategray">{t('header.welcomeBack')}</span>
              <span className="text-lg font-semibold text-charcoal">{username}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <nav className="hidden items-center gap-4 md:flex">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      isActive ? 'bg-rosegold text-white shadow' : 'text-slategray hover:text-charcoal'
                    }`
                  }
                >
                  {t(item.labelKey)}
                </NavLink>
              ))}
            </nav>
            <Button variant="secondary" onClick={toggleLanguage}>
              {language === 'en' ? 'FR' : 'EN'}
            </Button>
            <Button variant="secondary" onClick={() => setUsername(null)}>
              {t('action.logout')}
            </Button>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
        <div className="flex flex-wrap gap-3 md:hidden">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-full border px-3 py-2 text-xs font-semibold ${
                  isActive ? 'border-rosegold bg-rosegold text-white' : 'border-platinum text-slategray'
                }`
              }
            >
              {t(item.labelKey)}
            </NavLink>
          ))}
        </div>
        {children}
      </div>
    </div>
  );
}
