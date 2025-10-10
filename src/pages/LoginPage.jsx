import { useState } from 'react';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Logo } from '../components/Logo';
import { usePricingStore } from '../store/pricingStore';
import { useTranslation } from '../i18n/useTranslation';

const USERNAME = import.meta.env.VITE_APP_USERNAME ?? 'admin';
const PASSWORD = import.meta.env.VITE_APP_PASSWORD ?? 'password';

export function LoginPage() {
  const [username, setUsernameInput] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const setUsername = usePricingStore((state) => state.setUsername);
  const language = usePricingStore((state) => state.language);
  const setLanguage = usePricingStore((state) => state.setLanguage);
  const { t } = useTranslation();

  const handleSubmit = (event) => {
    event.preventDefault();
    if (username === USERNAME && password === PASSWORD) {
      setUsername(username);
      setError(null);
      return;
    }
    setError('Invalid credentials.');
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-primary-50 via-white to-neutral-100">
      <div className="pointer-events-none absolute -left-24 top-16 h-72 w-72 rounded-full bg-primary-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-16 h-80 w-80 rounded-full bg-success-200/40 blur-3xl" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-16 lg:flex-row lg:items-center lg:gap-16">
        <div className="mb-16 flex flex-1 flex-col gap-6 text-neutral-700 lg:mb-0">
          <div className="flex items-center gap-4">
            <div className="rounded-3xl bg-white/80 p-4 shadow-sm">
              <Logo />
            </div>
            <span className="text-sm font-medium uppercase tracking-wide text-neutral-500">Azor Jewelry</span>
          </div>
          <h1 className="text-4xl font-semibold text-neutral-900 sm:text-5xl">{t('login.heroTitle')}</h1>
          <p className="max-w-xl text-lg leading-relaxed text-neutral-600">{t('login.heroBody')}</p>
        </div>

        <div className="flex w-full flex-1 justify-center">
          <Card
            className="w-full max-w-md bg-white/90 backdrop-blur-sm shadow-xl"
            title={t('login.title')}
            subtitle={t('login.subtitle')}
          >
            <div className="mb-4 flex justify-end">
              <Button type="button" variant="secondary" onClick={() => setLanguage(language === 'en' ? 'fr' : 'en')}>
                {language === 'en' ? 'FR' : 'EN'}
              </Button>
            </div>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <Input
                label={t('login.username')}
                value={username}
                onChange={(event) => setUsernameInput(event.target.value)}
                autoComplete="username"
                required
              />
              <Input
                label={t('login.password')}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
              {error && <p className="text-base font-medium text-error-500">{error}</p>}
              <Button type="submit" className="w-full">
                {t('action.login')}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
