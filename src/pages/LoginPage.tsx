import { FormEvent, useState } from 'react';

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
  const [error, setError] = useState<string | null>(null);
  const setUsername = usePricingStore((state) => state.setUsername);
  const language = usePricingStore((state) => state.language);
  const setLanguage = usePricingStore((state) => state.setLanguage);
  const { t } = useTranslation();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (username === USERNAME && password === PASSWORD) {
      setUsername(username);
      setError(null);
      return;
    }
    setError('Invalid credentials.');
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-pearl px-4">
      <Logo />
      <Card className="mt-6 w-full max-w-md" title={t('login.title')} subtitle={t('login.subtitle')}>
        <div className="mb-4 flex justify-end">
          <Button type="button" variant="secondary" onClick={() => setLanguage(language === 'en' ? 'fr' : 'en')}>
            {language === 'en' ? 'FR' : 'EN'}
          </Button>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
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
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full">
            {t('action.login')}
          </Button>
          <p className="text-xs text-slategray">{t('login.tip')}</p>
        </form>
      </Card>
    </div>
  );
}
