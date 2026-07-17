import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './state/AuthContext.jsx';
import { OrderDraftProvider } from './state/OrderDraftContext.jsx';
import { CurrencyProvider } from './state/CurrencyContext.jsx';
import { TabProvider } from './state/TabContext.jsx';
import './i18n';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CurrencyProvider>
          <OrderDraftProvider>
            <TabProvider><App /></TabProvider>
          </OrderDraftProvider>
        </CurrencyProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
