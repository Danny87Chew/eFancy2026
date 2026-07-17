import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const TabContext = createContext(null);

const baseForPath = (path) => {
  if (path.startsWith('/espectacles')) return 'espectacles';
  if (path.startsWith('/egroceries')) return 'egroceries';
  if (path.startsWith('/efreshes')) return 'efreshes';
  if (path.startsWith('/flea-market')) return 'flea-market';
  if (path.startsWith('/eservices')) return 'eservices';
  return 'home';
};

export function TabProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [tabs, setTabs] = useState([{ id: 'home', label: 'Home', base: 'home', path: '/' }]);
  const [activeId, setActiveId] = useState('home');

  useEffect(() => {
    const base = baseForPath(location.pathname);
    // Utility pages always live in the fixed Home tab. This keeps any open
    // service tab pointed at the in-progress route the user left behind.
    if (base === 'home') {
      setActiveId('home');
      setTabs((current) => current.map((tab) => tab.id === 'home' ? { ...tab, path: location.pathname } : tab));
      return;
    }
    setTabs((current) => {
      const currentTab = current.find((tab) => tab.id === activeId);
      const target = currentTab?.base === base
        ? currentTab
        : current.find((tab) => tab.base === base && tab.path === location.pathname) || current.find((tab) => tab.base === base);
      if (!target) return current;
      if (target.id !== activeId) setActiveId(target.id);
      return current.map((tab) => tab.id === target.id ? { ...tab, path: location.pathname } : tab);
    });
  }, [activeId, location.pathname]);

  const openTab = useCallback((label, path) => {
    const base = baseForPath(path);
    const id = `${base}-${Date.now()}`;
    setTabs((current) => [...current, { id, label, base, path }]);
    setActiveId(id);
    navigate(path);
  }, [navigate]);

  const switchTab = useCallback((id) => {
    setTabs((current) => {
      const target = current.find((tab) => tab.id === id);
      if (target) navigate(target.path);
      return current;
    });
    setActiveId(id);
  }, [navigate]);

  const closeTab = useCallback((id) => {
    setTabs((current) => {
      const index = current.findIndex((tab) => tab.id === id);
      const next = current.filter((tab) => tab.id !== id);
      if (id === activeId && next.length) {
        const replacement = next[Math.max(0, index - 1)] || next[0];
        setActiveId(replacement.id);
        navigate(replacement.path);
      }
      return next.length ? next : current;
    });
  }, [activeId, navigate]);

  return <TabContext.Provider value={{ tabs, activeId, openTab, switchTab, closeTab }}>{children}</TabContext.Provider>;
}

export const useTabs = () => useContext(TabContext);
