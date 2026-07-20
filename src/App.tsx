import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import { NotificationProvider } from './context/NotificationContext';
import { AuthProvider } from './context/AuthContext';
import { CashProvider } from './context/CashContext';
import { ConfigProvider } from './context/ConfigContext';

const App = () => {
  return (
    <BrowserRouter>
      <NotificationProvider>
        <ConfigProvider>
          <AuthProvider>
            <CashProvider>
              <AppRoutes />
            </CashProvider>
          </AuthProvider>
        </ConfigProvider>
      </NotificationProvider>
    </BrowserRouter>
  );
};

export default App;
