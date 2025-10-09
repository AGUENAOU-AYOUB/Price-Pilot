import { Navigate, Route, Routes } from 'react-router-dom';

import { PageLayout } from './components/PageLayout';
import { usePricingStore } from './store/pricingStore';
import { DashboardPage } from './pages/DashboardPage';
import { GlobalPricingPage } from './pages/GlobalPricingPage';
import { BraceletsPage } from './pages/BraceletsPage';
import { NecklacesPage } from './pages/NecklacesPage';
import { RingsPage } from './pages/RingsPage';
import { HandChainsPage } from './pages/HandChainsPage';
import { SetsPage } from './pages/SetsPage';
import { LoginPage } from './pages/LoginPage';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/global-pricing" element={<GlobalPricingPage />} />
      <Route path="/bracelets" element={<BraceletsPage />} />
      <Route path="/necklaces" element={<NecklacesPage />} />
      <Route path="/rings" element={<RingsPage />} />
      <Route path="/hand-chains" element={<HandChainsPage />} />
      <Route path="/sets" element={<SetsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  const username = usePricingStore((state) => state.username);

  if (!username) {
    return <LoginPage />;
  }

  return (
    <PageLayout>
      <AppRoutes />
    </PageLayout>
  );
}
