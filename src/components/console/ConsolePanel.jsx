import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useConsole, LEVELS } from './ConsoleContext';
import { getCommand, getAllCommands } from './commands/index.js';
import { Grab } from 'lucide-react';

const LEVEL_PREFIX = {
  [LEVELS.INFO]:    '›',
  [LEVELS.WARN]:    '⚠',
  [LEVELS.ERROR]:   '✖',
  [LEVELS.SUCCESS]: '✔',
  [LEVELS.CMD]:     '$',
  [LEVELS.JSON]:    '{}',
};

// Colours applied directly to DOM nodes — not via React classes
const LEVEL_COLORS_HEX = {
  [LEVELS.INFO]:    '#86efac',
  [LEVELS.WARN]:    '#fcd34d',
  [LEVELS.ERROR]:   '#f87171',
  [LEVELS.SUCCESS]: '#34d399',
  [LEVELS.CMD]:     '#67e8f9',
  [LEVELS.JSON]:    '#c4b5fd',
};

const FONTS = [
  { label: 'Mono',  value: 'monospace' },
  { label: 'Sans',  value: 'sans-serif' },
  { label: 'Serif', value: 'serif' },
];

const SIZES = [
  { label: '10', value: '10px' },
  { label: '11', value: '11px' },
  { label: '12', value: '12px' },
  { label: '14', value: '14px' },
];

export default function ConsolePanel({ appState, setAppState }) {
  const con = useConsole();

  const [input, setInput]     = useState('');
  const [history, setHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [font, setFont]       = useState('monospace');
  const [size, setSize]       = useState('11px');
  const [fg, setFg]           = useState('#86efac');
  const [bg, setBg]           = useState('#1e1e1e');
  const [autoScroll, setAutoScroll] = useState(true);

  const inputRef      = useRef(null);
  const outputRef     = useRef(null);   // the raw DOM div we write into
  const lineCountRef  = useRef(0);      // how many lines we've already written

  // ── Write new lines directly to the DOM ───────────────────────────────────
  // This completely bypasses React's reconciliation for the output area.
  // Existing DOM nodes are never touched, so text selection survives.
  useEffect(() => {
    if (!outputRef.current) return;

    // cls command empties con.lines — clear the DOM too
    if (con.lines.length === 0) {
      outputRef.current.innerHTML = '';
      lineCountRef.current = 0;
      return;
    }

    // Only process lines we haven't written yet
    const newLines = con.lines.slice(lineCountRef.current);
    lineCountRef.current = con.lines.length;

    newLines.forEach(line => {
  const color  = LEVEL_COLORS_HEX[line.level] || fg;
  const prefix = LEVEL_PREFIX[line.level] || '›';
  const time   = line.ts.toLocaleTimeString();
  const row    = document.createElement('div');
  row.innerHTML = `
    <span style="color:${color};opacity:0.7;user-select:none;flex-shrink:0;">${prefix}</span>
    <span style="color:${color};white-space:pre-wrap;word-break:break-all;flex:1;">${line.text}</span>
    <span style="color:#4b5563;font-size:9px;user-select:none;flex-shrink:0;">${time}</span>
  `;
  row.style.cssText = 'display:flex;gap:8px;align-items:flex-start;margin-bottom:1px;';
  outputRef.current.appendChild(row);
});

    if (autoScroll) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [con.lines]);

  // Pause auto-scroll when user scrolls up
  const handleScroll = useCallback(() => {
    if (!outputRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = outputRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 32);
  }, []);

  const runInput = (raw) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    con.push(trimmed, LEVELS.CMD);
    setHistory(h => [trimmed, ...h].slice(0, 50));
    setHistIdx(-1);

    if (trimmed.toLowerCase() === 'help') {
      getAllCommands().forEach(cmd => {
        con.log(`  ${cmd.name.padEnd(12)} — ${cmd.description}  (usage: ${cmd.usage})`);
      });
      return;
    }

    const cmd = getCommand(trimmed);
    if (!cmd) {
      con.error(`Unknown command: "${trimmed.split(' ')[0]}". Type "help".`);
      return;
    }
    try {
      cmd.run({ console: con, appState, setAppState, rawInput: trimmed });
    } catch (err) {
      con.error(`Command error: ${err.message}`);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { runInput(input); setInput(''); }
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const idx = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(idx); setInput(history[idx] ?? '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const idx = Math.max(histIdx - 1, -1);
      setHistIdx(idx); setInput(idx === -1 ? '' : history[idx]);
    }
  };

  return (
    <div
      className="rounded-xl overflow-hidden shadow-2xl border border-gray-700 flex w-full"
      style={{ background: bg, minWidth: 0 }}
    >
      {/* ── Terminal area ── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Title bar */}
        <div className="flex items-center justify-between px-3 py-2 bg-gray-800 drag-handle select-none">
          <span className="text-xs text-gray-400 font-mono">TimesPast Console</span>
          <div className="flex items-center gap-2">
            {!autoScroll && (
              <button
                onClick={() => {
                  setAutoScroll(true);
                  if (outputRef.current)
                    outputRef.current.scrollTop = outputRef.current.scrollHeight;
                }}
                className="text-[10px] text-yellow-400 hover:text-yellow-200 border border-yellow-600 rounded px-1.5 py-0.5"
              >
                ↓ bottom
              </button>
            )}
            <Grab className="w-4 h-4 text-gray-500" />
          </div>
        </div>

        {/* Output — a plain div we write into directly, React never re-renders it */}
        <div
          ref={outputRef}
          onScroll={handleScroll}
          style={{
            minHeight: 220, maxHeight: 360,
            overflowY: 'auto',
            padding: '8px 12px',
            cursor: 'text',
            userSelect: 'text',
            WebkitUserSelect: 'text',
            MozUserSelect: 'text',
          }}

        />

        {/* Input row */}
        <div
          className="flex items-center gap-2 px-3 py-2 border-t border-gray-700"
          style={{ background: bg, fontFamily: font, fontSize: size }}
        >
          <span style={{ color: fg, opacity: 0.6, userSelect: 'none' }}>$</span>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent outline-none"
            style={{ color: fg, caretColor: fg, fontFamily: font, fontSize: size }}
            placeholder="type a command…"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </div>

      {/* ── Appearance sidebar ── */}
      <div className="flex flex-col gap-4 px-2 py-3 bg-gray-900 border-l border-gray-700 w-24 flex-shrink-0 overflow-y-auto">

        <section>
          <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Font</p>
          {FONTS.map(f => (
            <button key={f.value} onClick={() => setFont(f.value)}
              className={`block w-full text-left text-[10px] px-1 py-0.5 rounded mb-0.5 transition-colors ${
                font === f.value ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'
              }`}>
              {f.label}
            </button>
          ))}
        </section>

        <section>
          <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Size</p>
          <div className="grid grid-cols-2 gap-0.5">
            {SIZES.map(s => (
              <button key={s.value} onClick={() => setSize(s.value)}
                className={`text-[10px] px-1 py-0.5 rounded transition-colors ${
                  size === s.value ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'
                }`}>
                {s.label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-2">Text</p>
          <input type="color" value={fg} onChange={e => setFg(e.target.value)}
            className="w-full h-8 rounded cursor-pointer border-0 bg-transparent"
            title="Text colour" />
        </section>

        <section>
          <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-2">Background</p>
          <input type="color" value={bg} onChange={e => setBg(e.target.value)}
            className="w-full h-8 rounded cursor-pointer border-0 bg-transparent"
            title="Background colour" />
        </section>

      </div>
    </div>
  );
}
