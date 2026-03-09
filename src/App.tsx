import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import { NotificationProvider } from './context/NotificationContext';
import { AuthProvider } from './context/AuthContext';
import { CashProvider } from './context/CashContext';

const App = () => {
  return (
    <BrowserRouter>
      <NotificationProvider>
        <AuthProvider>
          <CashProvider>
            <AppRoutes />
          </CashProvider>
        </AuthProvider>
      </NotificationProvider>
    </BrowserRouter>
  );
};

export default App;
