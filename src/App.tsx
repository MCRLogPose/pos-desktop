import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import { NotificationProvider } from './context/NotificationContext';
import { AuthProvider } from './context/AuthContext';
import { CashProvider } from './context/CashContext';
import { ConfigProvider, useConfig } from './context/ConfigContext';
import SetupPage from './features/setup/pages/SetupPage';

function ConfigGuard() {
  const { isConfigured, loading } = useConfig();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {!isConfigured && <Route path="*" element={<SetupPage />} />}
      {isConfigured && <Route path="*" element={
        <AuthProvider>
          <CashProvider>
            <AppRoutes />
          </CashProvider>
        </AuthProvider>
      } />}
    </Routes>
  );
}

const App = () => {
  return (
    <BrowserRouter>
      <NotificationProvider>
        <ConfigProvider>
          <ConfigGuard />
        </ConfigProvider>
      </NotificationProvider>
    </BrowserRouter>
  );
};

export default App;
