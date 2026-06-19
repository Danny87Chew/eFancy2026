import React from 'react';
import { useTranslation } from 'react-i18next';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import AdminFrames from './AdminFrames.jsx';
import AdminVendors from './AdminVendors.jsx';
import AdminVendorCreate from './AdminVendorCreate.jsx';
import AdminLensBrands from './AdminLensBrands.jsx';
import AdminConfig from './AdminConfig.jsx';
import AdminOrders from './AdminOrders.jsx';
import AdminUsers from './AdminUsers.jsx';
import { useAuth } from '../../state/AuthContext.jsx';

export default function Admin() {
  const { user } = useAuth();
  const isSuper = user.role === 'super_admin';
  const { t } = useTranslation();

  return (
    <div>
      <h1 className="h1">{t('Administration')}</h1>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 12 }}>
        <NavLink to="frames" className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>{t('Frames') || 'Frames'}</NavLink>
        <NavLink to="vendors" className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>{t('Vendors') || 'Vendors'}</NavLink>
        <NavLink to="lens-brands" className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>{t('Lens brands') || 'Lens brands'}</NavLink>
        <NavLink to="orders" className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>{t('Orders')}</NavLink>
        {isSuper && <NavLink to="config" className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>{t('Config')}</NavLink>}
        {isSuper && <NavLink to="users" className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>{t('Users')}</NavLink>}
      </div>
      <Routes>
        <Route index element={<Navigate to="frames" replace />} />
        <Route path="frames" element={<AdminFrames />} />
        <Route path="vendors" element={<AdminVendors />} />
        <Route path="vendors/add" element={<AdminVendorCreate />} />
        <Route path="vendors/:id/edit" element={<AdminVendorCreate />} />
        <Route path="shops" element={<Navigate to="/admin/vendors" replace />} />
        <Route path="lens-brands" element={<AdminLensBrands />} />
        <Route path="orders" element={<AdminOrders />} />
        {isSuper && <Route path="config" element={<AdminConfig />} />}
        {isSuper && <Route path="users" element={<AdminUsers />} />}
      </Routes>
    </div>
  );
}
