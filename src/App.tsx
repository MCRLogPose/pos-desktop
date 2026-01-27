import './App.css'
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from '@/routes/AppRoutes.jsx';
import { AuthProvider } from '@/features/auth/context/AuthContext';

const App = () => {

  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
