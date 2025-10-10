import { useState } from 'react';

import { Button } from '../components/Button';
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,_#ffe6f8,_#fdf5ff_55%,_#e0f2ff)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-white/40 blur-[160px]" />
        <div className="absolute -bottom-48 right-[-140px] h-[420px] w-[420px] rounded-full bg-primary-200/35 blur-[140px]" />
        <div className="absolute bottom-24 left-[-160px] h-[360px] w-[360px] rounded-full bg-success-200/35 blur-[140px]" />
      </div>

      <div className="relative z-10 w-full max-w-md px-6">
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            className="h-10 rounded-full border border-white/60 bg-white/70 px-4 text-sm font-semibold text-neutral-600 shadow-sm backdrop-blur-md hover:bg-white"
            onClick={() => setLanguage(language === 'en' ? 'fr' : 'en')}
          >
            {language === 'en' ? 'FR' : 'EN'}
          </Button>
        </div>

        <div className="mt-6 rounded-[32px] border border-white/60 bg-white/80 p-10 text-center shadow-[0_24px_60px_-24px_rgba(79,70,229,0.45)] backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/85 shadow-inner">
            <Logo />
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.4em] text-neutral-500">Azor Admin</p>
          <h1 className="mt-4 text-3xl font-semibold text-neutral-900">{t('login.welcomeTitle')}</h1>
          <p className="mt-2 text-base text-neutral-600">{t('login.welcomeSubtitle')}</p>

          <form className="mt-8 space-y-5 text-left" onSubmit={handleSubmit}>
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
            {error && <p className="rounded-xl bg-error-50 p-3 text-sm font-medium text-error-600">{error}</p>}
            <Button type="submit" className="h-12 w-full rounded-2xl text-base">
              {t('action.login')}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
