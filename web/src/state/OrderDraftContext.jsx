import React, { createContext, useContext, useState } from 'react';

// In-progress eSpectacles order draft kept in memory + sessionStorage
const Ctx = createContext(null);

const KEY = 'efancy_draft';

function load() {
  try { return JSON.parse(sessionStorage.getItem(KEY) || '{}'); } catch { return {}; }
}

export function OrderDraftProvider({ children }) {
  const [draft, setDraftState] = useState(load());

  const setDraft = (patch) => {
    setDraftState(prev => {
      const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
      sessionStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  };

  const reset = () => { sessionStorage.removeItem(KEY); setDraftState({}); };

  return <Ctx.Provider value={{ draft, setDraft, reset }}>{children}</Ctx.Provider>;
}

export const useDraft = () => useContext(Ctx);
