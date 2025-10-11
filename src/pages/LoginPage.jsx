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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#f8fafb] via-[#e5eaed] to-white text-[#1e2835]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[#c5d9e3]/60 blur-[180px]" />
        <div className="absolute -bottom-48 right-[-140px] h-[420px] w-[420px] rounded-full bg-[#e8f2f7] blur-[140px]" />
        <div className="absolute bottom-16 left-[-160px] h-[360px] w-[360px] rounded-full bg-[#e8f5f0] blur-[150px]" />
      </div>

      <div className="absolute right-6 top-6 z-20 sm:right-8 sm:top-8">
        <Button
          type="button"
          variant="secondary"
          className="h-10 rounded-full px-5"
          onClick={() => setLanguage(language === 'en' ? 'fr' : 'en')}
        >
          {language === 'en' ? 'FR' : 'EN'}
        </Button>
      </div>

      <div className="relative z-10 w-full max-w-md px-6">
        <div className="mt-6 rounded-[32px] border border-[#d7e0e8] bg-white/95 p-10 text-center text-[#1e2835] shadow-[0_36px_100px_-38px_rgba(26,58,74,0.45)] backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#d7e0e8] bg-[#e8f2f7] text-[#1a3a4a] shadow-[0_12px_30px_-18px_rgba(26,58,74,0.45)]">
            <Logo />
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.32em] text-[#5a6c7d]">Azor Admin</p>
          <h1 className="mt-4 text-3xl font-semibold text-[#1e2835]">{t('login.welcomeTitle')}</h1>
          <p className="mt-2 text-base text-[#5a6c7d]">{t('login.welcomeSubtitle')}</p>

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
            {error && (
              <p className="rounded-xl border border-[#d64545]/30 bg-[#d64545]/10 p-3 text-sm font-medium text-[#b93838]">
                {error}
              </p>
            )}
            <Button type="submit" className="h-12 w-full rounded-2xl text-base">
              {t('action.login')}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
