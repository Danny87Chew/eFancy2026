import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useAuth } from './AuthContext.jsx';
import { formatMoney, currencySymbol } from '../utils/money';

const CurrencyCtx = createContext(null);
const LS_KEY = 'efancy_currency';

export function CurrencyProvider({ children }) {
  const { user } = useAuth();
  const [currency, setCurrencyState] = useState(() => localStorage.getItem(LS_KEY) || null);
  const [rate, setRate] = useState(5.3);

  useEffect(() => {
    api('/api/config/public').then(d => {
      if (d.sgd_to_rmb_rate) setRate(Number(d.sgd_to_rmb_rate));
    }).catch(() => {});
  }, []);

  // Initialise from the user's vendor default if no explicit choice yet.
  useEffect(() => {
    if (currency) return;
    if (user?.default_currency) setCurrencyState(user.default_currency);
  }, [user, currency]);

  const setCurrency = (c) => {
    const next = c === 'RMB' ? 'RMB' : 'SGD';
    setCurrencyState(next);
    localStorage.setItem(LS_KEY, next);
  };

  const value = useMemo(() => {
    const eff = currency || 'SGD';
    return {
      currency: eff,
      setCurrency,
      rate,
      fmt: (sgd) => formatMoney(sgd, eff, rate),
      symbol: currencySymbol(eff),
    };
  }, [currency, rate]);

  return <CurrencyCtx.Provider value={value}>{children}</CurrencyCtx.Provider>;
}

export const useCurrency = () => useContext(CurrencyCtx);
