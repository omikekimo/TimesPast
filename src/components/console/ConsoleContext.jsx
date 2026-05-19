import React, { createContext, useContext, useState, useCallback } from 'react';

const ConsoleContext = createContext(null);

export const LEVELS = {
  INFO:    'info',
  WARN:    'warn',
  ERROR:   'error',
  SUCCESS: 'success',
  CMD:     'cmd',
  JSON:    'json',
};

export function ConsoleProvider({ children }) {
  const [lines, setLines] = useState([
    { id: 0, level: LEVELS.INFO, text: 'TimesPast Console ready. Type "help" for commands.', ts: new Date() }
  ]);
  const [counter, setCounter] = useState(1);

  const push = useCallback((text, level = LEVELS.INFO) => {
    setCounter(c => {
      const id = c;
      setLines(prev => [...prev, { id, level, text: String(text), ts: new Date() }]);
      return c + 1;
    });
  }, []);

  const log     = useCallback((t) => push(t, LEVELS.INFO),    [push]);
  const warn    = useCallback((t) => push(t, LEVELS.WARN),    [push]);
  const error   = useCallback((t) => push(t, LEVELS.ERROR),   [push]);
  const success = useCallback((t) => push(t, LEVELS.SUCCESS), [push]);
  const json    = useCallback((obj) => {
    push(JSON.stringify(obj, null, 2), LEVELS.JSON);
  }, [push]);

  const clear = useCallback(() => setLines([]), []);

  return (
    <ConsoleContext.Provider value={{ lines, log, warn, error, success, json, clear, push }}>
      {children}
    </ConsoleContext.Provider>
  );
}

export function useConsole() {
  const ctx = useContext(ConsoleContext);
  if (!ctx) throw new Error('useConsole must be used within ConsoleProvider');
  return ctx;
}
