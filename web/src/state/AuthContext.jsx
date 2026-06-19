import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../api';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [vendorContext, setVendorContext] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem('efancy_token');
    if (!t) { setLoading(false); return; }
    api('/api/auth/me').then(d => setUser(d.user)).catch(() => {
      localStorage.removeItem('efancy_token');
    }).finally(() => setLoading(false));
  }, []);

  const requestOtp = useCallback((mobile, intent, role, vendor_info) =>
    api('/api/auth/otp/request', { method: 'POST', body: { mobile, intent, role, vendor_info } }), []);

  const verifyOtp = useCallback(async (mobile, code, intent, role, vendor_info) => {
    const d = await api('/api/auth/otp/verify', { method: 'POST', body: { mobile, code, intent, role, vendor_info } });
    localStorage.setItem('efancy_token', d.token);
    setUser(d.user);
    setVendorContext(d.vendor_context || null);
    return d; // return full response so callers can check vendor_context
  }, []);

  const logout = useCallback(async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch {}
    localStorage.removeItem('efancy_token');
    setUser(null);
    setVendorContext(null);
  }, []);

  const updateProfile = useCallback(async (patch) => {
    const d = await api('/api/auth/me', { method: 'PATCH', body: patch });
    setUser(d.user);
    return d.user;
  }, []);

  return (
    <AuthCtx.Provider value={{ user, vendorContext, loading, requestOtp, verifyOtp, logout, updateProfile }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
