import React, { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import AdminFrames from './AdminFrames.jsx';
import AdminVendors from './AdminVendors.jsx';
import AdminVendorCreate from './AdminVendorCreate.jsx';
import AdminLensBrands from './AdminLensBrands.jsx';
import AdminConfig from './AdminConfig.jsx';
import AdminOrders from './AdminOrders.jsx';
import AdminUsers from './AdminUsers.jsx';
import AdminGoodsCategories from './AdminGoodsCategories.jsx';
import AdminGoodsCategoryHome from './AdminGoodsCategoryHome.jsx';
import AdminGoodsSubCategories from './AdminGoodsSubCategories.jsx';
import { useAuth } from '../../state/AuthContext.jsx';
import { STAFF_ROLES } from '../../roles.js';

export default function Admin() {
  const { user } = useAuth();
  const isSuper = user.role === 'super_admin';
  const isStaff = STAFF_ROLES.includes(user?.role);

  const { t } = useTranslation();
  const tabsRef = useRef(null);
  const location = useLocation();

  const centerTab = (el) => {
    const container = tabsRef.current;
    if (!container || !el) return;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const delta = elRect.left - containerRect.left;
    const scrollLeft = container.scrollLeft + delta - (container.clientWidth - el.offsetWidth) / 2;
    container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
  };

  useEffect(() => {
    const active = tabsRef.current?.querySelector('.tab.active');
    if (active) centerTab(active);
  }, [location.pathname]);

  return (
    <div>
      <h1 className="h1">{t('Administration')}</h1>
      {!location.pathname.startsWith('/admin/goods-categories') && (
        <div ref={tabsRef} style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 12 }}>
          {!isStaff && <NavLink to="frames" onClick={(e) => centerTab(e.currentTarget)} className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>{t('Frames') || 'Frames'}</NavLink>}
          {!isStaff && <NavLink to="vendors" onClick={(e) => centerTab(e.currentTarget)} className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>{t('Vendors') || 'Vendors'}</NavLink>}
          {!isStaff && <NavLink to="lens-brands" onClick={(e) => centerTab(e.currentTarget)} className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>{t('Lens brands') || 'Lens brands'}</NavLink>}
          <NavLink to="orders" onClick={(e) => centerTab(e.currentTarget)} className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>{t('Orders')}</NavLink>
          {isSuper && <NavLink to="config" onClick={(e) => centerTab(e.currentTarget)} className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>{t('Config')}</NavLink>}
          {isSuper && <NavLink to="users" onClick={(e) => centerTab(e.currentTarget)} className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>{t('Users')}</NavLink>}
        </div>
      )}
      <Routes>
        <Route index element={<Navigate to={isStaff ? 'orders' : 'frames'} replace />} />
        {!isStaff && <Route path="frames" element={<AdminFrames />} />}
        {!isStaff && <Route path="goods-categories" element={<AdminGoodsCategoryHome />} />}
        {!isStaff && <Route path="goods-categories/main" element={<AdminGoodsCategories />} />}
        {!isStaff && <Route path="goods-categories/sub" element={<AdminGoodsSubCategories />} />}
        {!isStaff && <Route path="vendors" element={<AdminVendors />} />}
        {!isStaff && <Route path="vendors/add" element={<AdminVendorCreate />} />}
        {!isStaff && <Route path="vendors/:id/edit" element={<AdminVendorCreate />} />}
        {!isStaff && <Route path="shops" element={<Navigate to="/admin/vendors" replace />} />}
        {!isStaff && <Route path="lens-brands" element={<AdminLensBrands />} />}
        <Route path="orders" element={<AdminOrders />} />
        {isSuper && <Route path="config" element={<AdminConfig />} />}
        {isSuper && <Route path="users" element={<AdminUsers />} />}
      </Routes>
    </div>
  );
}
