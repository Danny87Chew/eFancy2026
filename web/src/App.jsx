import React, { useState } from 'react';
import { Routes, Route, Navigate, NavLink, useLocation, useNavigate } from 'react-router-dom';
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
import { useTabs } from './state/TabContext.jsx';

function LineIcon({ name }) {
  const paths = {
    home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" /><path d="M9 21v-6h6v6" /></>,
    orders: <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3h8v4H8zM8 12h8M8 16h5" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.55V20.3h-3v-.09A1.7 1.7 0 0 0 10.68 18.7a1.7 1.7 0 0 0-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 7.02 15a1.7 1.7 0 0 0-1.55-1.03H5.4v-3h.07A1.7 1.7 0 0 0 7.02 9.94 1.7 1.7 0 0 0 6.68 8.06L6.62 8 8.74 5.88l.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1.03-1.55V4.7h3v.03a1.7 1.7 0 0 0 1.03 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06L19.8 8l-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.55 1.03h.07v3h-.07A1.7 1.7 0 0 0 19.4 15Z" /></>,
    cart: <><path d="M3 4h2l2.2 11.1a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 1.9-1.4L21 8H7" /><circle cx="10" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></>,
    back: <><path d="M19 12H5" /><path d="m11 18-6-6 6-6" /></>,
  };
  return <svg className="line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

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
  const { openTab } = useTabs();
  const [menuOpen, setMenuOpen] = useState(false);
  if (isAdminLike) {
    return (
      <div className="topbar-actions">
        <button className="btn secondary topbar-logout" onClick={onLogout}>{t('Logout')}</button>
      </div>
    );
  }

  return (
    <div className="menu-shell">
      <button className="menu-trigger" onClick={() => setMenuOpen((open) => !open)} aria-label="Open menu" aria-expanded={menuOpen}>
        <span></span><span></span><span></span>
      </button>
      {menuOpen && (
        <nav className="menu-panel" aria-label="Main navigation">
          <button onClick={() => { openTab(t('eSpectacles'), '/espectacles'); setMenuOpen(false); }}>{t('eSpectacles')}</button>
          <button onClick={() => { openTab(t('eGroceries'), '/egroceries'); setMenuOpen(false); }}>{t('eGroceries')}</button>
          <button onClick={() => { openTab(t('eFreshes'), '/efreshes'); setMenuOpen(false); }}>{t('eFreshes')}</button>
          <button onClick={() => { openTab(t('e-Flea Market'), '/flea-market'); setMenuOpen(false); }}>{t('e-Flea Market')}</button>
          <button onClick={() => { openTab(t('eServices'), '/eservices'); setMenuOpen(false); }}>{t('eServices')}</button>
        </nav>
      )}
    </div>
  );
}

function WorkspaceTabs() {
  const { t } = useTranslation();
  const { tabs, activeId, openTab, switchTab, closeTab } = useTabs();
  const [closingIds, setClosingIds] = useState(new Set());
  const [animatingTabId, setAnimatingTabId] = useState(null);

  const handleClose = (id) => {
    setClosingIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      closeTab(id);
      setClosingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 200);
  };

  const handleSwitch = (id) => {
    setAnimatingTabId(id);
    switchTab(id);
    setTimeout(() => setAnimatingTabId(null), 300);
  };

  return (
    <div className="workspace-tabs" aria-label="Open pages">
      <div className="workspace-tabs-scroll">
        {tabs.map((tab) => {
          const isClosing = closingIds.has(tab.id);
          const isAnimating = animatingTabId === tab.id;
          return (
            <div
              key={tab.id}
              className={'workspace-tab' + (tab.id === activeId ? ' active' : '') + (tab.id === 'home' ? ' home-tab' : '') + (isClosing ? ' tab-closing' : '') + (isAnimating ? ' tab-switching' : '')}
              style={{
                animation: isClosing ? 'scaleOut 0.2s var(--ease-out) both' : undefined,
                transition: 'all 0.25s var(--ease-out)',
              }}
            >
              <button className="workspace-tab-label" onClick={() => handleSwitch(tab.id)} aria-label={tab.id === 'home' ? t('Home') : undefined}>
                {tab.id === 'home' ? <LineIcon name="home" /> : tab.label}
              </button>
              {tab.id !== 'home' && <button className="workspace-tab-close" onClick={() => handleClose(tab.id)} aria-label={`${t('Close')} ${tab.label}`}>×</button>}
            </div>
          );
        })}
        <button className="workspace-tab-add" onClick={() => openTab(t('New tab'), '/') } aria-label={t('New tab')}>+</button>
      </div>
    </div>
  );
}

function BottomBar() {
  const { user, vendorContext, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { tabs, activeId, closeTab } = useTabs();
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
  const handleBack = () => {
    const activeTab = tabs.find((tab) => tab.id === activeId);
    const isServiceStart = activeTab && activeTab.id !== 'home' && location.pathname === `/${activeTab.base}`;
    if (isServiceStart) {
      closeTab(activeTab.id);
      return;
    }
    navigate(-1);
  };
  return (
    <nav className="bottombar">
      {!isAdminLike && (
        <button className="bot-tab bot-back" onClick={handleBack}>
          <span className="icon"><LineIcon name="back" /></span>{t('Back')}
        </button>
      )}
      {!isAdminLike && (
        <NavLink to="/" end className={({ isActive }) => 'bot-tab' + (isActive ? ' active' : '')}>
          <span className="icon"><LineIcon name="home" /></span>{t('Home')}
        </NavLink>
      )}
      {!isAdminLike && (
        <NavLink to="/orders" className={({ isActive }) => 'bot-tab' + (isActive ? ' active' : '')}>
          <span className="icon"><LineIcon name="orders" /></span>{t('Orders')}
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
      <NavLink to="/settings" className={({ isActive }) => 'bot-tab' + (isActive ? ' active' : '')}>
        <span className="icon"><LineIcon name="settings" /></span>{t('Settings')}
      </NavLink>
      {isAdminLike && (
        <button className="bot-tab bot-logout" onClick={logout}>
          <span className="icon">🚪</span>{t('Logout')}
        </button>
      )}
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
          {!isLogin && !isAdminLike && <WorkspaceTabs />}
          <div className="topbar-right">
            {!isLogin && !isAdminLike && (
              <NavLink to="/cart" className={({ isActive }) => 'top-cart' + (isActive ? ' active' : '')} aria-label={t('Cart')}>
                <LineIcon name="cart" />
              </NavLink>
            )}
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
          <Route path="/flea-market" element={<Protected><Placeholder title={t('e-Flea Market')} /></Protected>} />
          <Route path="/eservices" element={<Protected><Placeholder title={t('eServices')} /></Protected>} />
          <Route path="/orders" element={<Protected><Orders /></Protected>} />
          <Route path="/orders/:id" element={<Protected><OrderDetail /></Protected>} />
          <Route path="/cart" element={<Protected><Cart /></Protected>} />
          <Route path="/settings" element={<Protected><Me /></Protected>} />
          <Route path="/me" element={<Navigate to="/settings" replace />} />
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
