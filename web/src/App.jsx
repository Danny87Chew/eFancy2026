import React from 'react';
import { Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from './state/AuthContext.jsx';
import { VENDOR_ROLES } from './roles.js';
import { useTranslation } from 'react-i18next';
import Login from './pages/Login.jsx';
import Home from './pages/Home.jsx';
import ESpectaclesHome from './pages/espectacles/ESpectaclesHome.jsx';
import ChooseFrame from './pages/espectacles/ChooseFrame.jsx';
import EyesightChoice from './pages/espectacles/EyesightChoice.jsx';
import Ordering from './pages/espectacles/Ordering.jsx';
import Confirmation from './pages/espectacles/Confirmation.jsx';
import Payment from './pages/espectacles/Payment.jsx';
import CheckupPending from './pages/espectacles/CheckupPending.jsx';
import ManualEyesight from './pages/espectacles/ManualEyesight.jsx';
import Orders from './pages/Orders.jsx';
import OrderDetail from './pages/OrderDetail.jsx';
import Cart from './pages/Cart.jsx';
import Me from './pages/Me.jsx';
import Placeholder from './pages/Placeholder.jsx';
import Admin from './pages/admin/Admin.jsx';
import VendorCheckup from './pages/vendor/VendorCheckup.jsx';
import VendorManufacture from './pages/vendor/VendorManufacture.jsx';
import LanguageSelector from './components/LanguageSelector.jsx';

function HomeRoute() {
  const { user, vendorContext } = useAuth();
  const isAdmin = user && (user.role === 'admin' || user.role === 'super_admin');
  if (isAdmin) return <Navigate to="/admin" replace />;
  const vendorRole = (user && VENDOR_ROLES.includes(user.role)) ? user.role : vendorContext?.role;
  if (vendorRole === 'spectacle_checkup_vendor') return <Navigate to="/vendor/checkup" replace />;
  if (vendorRole === 'spectacle_producer_vendor') return <Navigate to="/vendor/manufacture" replace />;
  return <Home />;
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  const { t } = useTranslation();
  if (loading) return <div className="content">{t('Loading')}</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function TopTabs({ isAdminLike, onLogout }) {
  const { t } = useTranslation();
  if (isAdminLike) {
    return (
      <div className="topbar-actions">
        <button className="btn secondary topbar-logout" onClick={onLogout}>{t('Logout')}</button>
      </div>
    );
  }

  return (
    <nav className="topbar-tabs">
      <NavLink to="/" end className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>{t('Home')}</NavLink>
      <NavLink to="/espectacles" className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>{t('eSpectacles')}</NavLink>
      <NavLink to="/egroceries" className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>{t('eGroceries')}</NavLink>
      <NavLink to="/efreshes" className={({ isActive }) => 'tab efreshes-tab' + (isActive ? ' active' : '')}>{t('eFreshes')}</NavLink>
      <NavLink to="/eservices" className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>{t('eServices')}</NavLink>
    </nav>
  );
}

function BottomBar() {
  const { user, vendorContext, logout } = useAuth();
  const { t } = useTranslation();
  const isAdmin = user && (user.role === 'admin' || user.role === 'super_admin');
  const isCheckupVendor = user && (
    user.role === 'spectacle_checkup_vendor' ||
    vendorContext?.role === 'spectacle_checkup_vendor'
  );
  const isProducerVendor = user && (
    user.role === 'spectacle_producer_vendor' ||
    vendorContext?.role === 'spectacle_producer_vendor'
  );
  const isOtherVendor = user && (
    (VENDOR_ROLES.includes(user.role) && !isCheckupVendor && !isProducerVendor) ||
    (vendorContext?.role && VENDOR_ROLES.includes(vendorContext.role) && !isCheckupVendor && !isProducerVendor)
  );
  const isVendorLike = isCheckupVendor || isProducerVendor || isOtherVendor;
  const isAdminLike = isAdmin || isVendorLike;
  return (
    <nav className="bottombar">
      {!isAdminLike && (
        <NavLink to="/cart" className={({ isActive }) => 'bot-tab' + (isActive ? ' active' : '')}>
          <span className="icon">🛒</span>{t('Cart')}
        </NavLink>
      )}
      {!isAdminLike && (
        <NavLink to="/orders" className={({ isActive }) => 'bot-tab' + (isActive ? ' active' : '')}>
          <span className="icon">📦</span>{t('Orders')}
        </NavLink>
      )}
      {isAdmin && (
        <NavLink to="/admin" className={({ isActive }) => 'bot-tab' + (isActive ? ' active' : '')}>
          <span className="icon">🛠️</span>{t('Administration')}
        </NavLink>
      )}
      {!isAdmin && isCheckupVendor && (
        <NavLink to="/vendor/checkup" className={({ isActive }) => 'bot-tab' + (isActive ? ' active' : '')}>
          <span className="icon">🛠️</span>{t('Administration')}
        </NavLink>
      )}
      {!isAdmin && !isCheckupVendor && isProducerVendor && (
        <NavLink to="/vendor/manufacture" className={({ isActive }) => 'bot-tab' + (isActive ? ' active' : '')}>
          <span className="icon">🛠️</span>{t('Administration')}
        </NavLink>
      )}
      <NavLink to="/me" className={({ isActive }) => 'bot-tab' + (isActive ? ' active' : '')}>
        <span className="icon">👤</span>{t('Me')}
      </NavLink>
      <button className="bot-tab bot-logout" onClick={logout}>
        <span className="icon">🚪</span>{t('Logout')}
      </button>
    </nav>
  );
}

export default function App() {
  const { user, vendorContext, logout } = useAuth();
  const { t } = useTranslation();
  const loc = useLocation();
  const isLogin = loc.pathname === '/login';
  const isAdmin = user && (user.role === 'admin' || user.role === 'super_admin');
  const isVendorLike = !!(user && (
    VENDOR_ROLES.includes(user.role) ||
    (vendorContext?.role && VENDOR_ROLES.includes(vendorContext.role))
  ));
  const isAdminLike = isAdmin || isVendorLike;

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          {!isLogin ? (
            <TopTabs isAdminLike={isAdminLike} onLogout={logout} />
          ) : (
            <></>
          )}
          <div className="topbar-right">
            {!isLogin && <LanguageSelector />}
          </div>
        </div>
      </header>
      <main className="content">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Protected><HomeRoute /></Protected>} />
          <Route path="/espectacles" element={<Protected><ESpectaclesHome /></Protected>} />
          <Route path="/espectacles/frames" element={<Protected><ChooseFrame /></Protected>} />
          <Route path="/espectacles/eyesight" element={<Protected><EyesightChoice /></Protected>} />
          <Route path="/espectacles/ordering" element={<Protected><Ordering /></Protected>} />
          <Route path="/espectacles/confirm" element={<Protected><Confirmation /></Protected>} />
          <Route path="/espectacles/pay/:id" element={<Protected><Payment /></Protected>} />
          <Route path="/espectacles/checkup/:id" element={<Protected><CheckupPending /></Protected>} />
          <Route path="/espectacles/manual-eyesight" element={<Protected><ManualEyesight /></Protected>} />
          <Route path="/espectacles/manual-eyesight/:id" element={<Protected><ManualEyesight /></Protected>} />
          <Route path="/egroceries" element={<Protected><Placeholder title={t('eGroceries')} /></Protected>} />
          <Route path="/efreshes" element={<Protected><Placeholder title={t('eFreshes')} /></Protected>} />
          <Route path="/eservices" element={<Protected><Placeholder title={t('eServices')} /></Protected>} />
          <Route path="/orders" element={<Protected><Orders /></Protected>} />
          <Route path="/orders/:id" element={<Protected><OrderDetail /></Protected>} />
          <Route path="/cart" element={<Protected><Cart /></Protected>} />
          <Route path="/me" element={<Protected><Me /></Protected>} />
          <Route path="/admin/*" element={<Protected><Admin /></Protected>} />
          <Route path="/vendor/checkup" element={<Protected><VendorCheckup /></Protected>} />
          <Route path="/vendor/manufacture" element={<Protected><VendorManufacture /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!isLogin && <BottomBar />}
    </div>
  );
}
