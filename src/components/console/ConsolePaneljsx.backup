import React, { useState, useRef, useEffect } from 'react';
import { useConsole, LEVELS } from './ConsoleContext';
import { getCommand, getAllCommands } from './commands/index.js';
import { Grab, X } from 'lucide-react';

// ── Colour scheme per log level ─────────────────────────────────────────────
const LEVEL_COLORS = {
  [LEVELS.INFO]:    'text-green-300',
  [LEVELS.WARN]:    'text-yellow-400',
  [LEVELS.ERROR]:   'text-red-400',
  [LEVELS.SUCCESS]: 'text-emerald-400',
  [LEVELS.CMD]:     'text-cyan-400',
  [LEVELS.JSON]:    'text-violet-300',
};

const LEVEL_PREFIX = {
  [LEVELS.INFO]:    '›',
  [LEVELS.WARN]:    '⚠',
  [LEVELS.ERROR]:   '✖',
  [LEVELS.SUCCESS]: '✔',
  [LEVELS.CMD]:     '$',
  [LEVELS.JSON]:    '{}',
};

// ── Font options ─────────────────────────────────────────────────────────────
const FONTS = [
  { label: 'Mono',    value: 'font-mono' },
  { label: 'Sans',    value: 'font-sans' },
  { label: 'Serif',   value: 'font-serif' },
];

const SIZES = [
  { label: '10', value: 'text-[10px]' },
  { label: '11', value: 'text-[11px]' },
  { label: '12', value: 'text-xs' },
  { label: '14', value: 'text-sm' },
];

// Text colour presets (fg)
const FG_COLORS = [
  { label: 'Green',  value: '#86efac' },
  { label: 'Amber',  value: '#fcd34d' },
  { label: 'Cyan',   value: '#67e8f9' },
  { label: 'White',  value: '#f1f5f9' },
  { label: 'Pink',   value: '#f9a8d4' },
];

// Background presets
const BG_COLORS = [
  { label: 'Charcoal', value: '#1e1e1e' },
  { label: 'Black',    value: '#0a0a0a' },
  { label: 'Navy',     value: '#0f172a' },
  { label: 'Dark teal',value: '#042f2e' },
];

export default function ConsolePanel({ appState, setAppState }) {
  const con = useConsole();
  const [input, setInput]     = useState('');
  const [history, setHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [font, setFont]       = useState(FONTS[0].value);
  const [size, setSize]       = useState(SIZES[1].value);
  const [fg, setFg]           = useState(FG_COLORS[0].value);
  const [bg, setBg]           = useState(BG_COLORS[0].value);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  // Auto-scroll to bottom on new output
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [con.lines]);

  const runInput = (raw) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    con.push(`${trimmed}`, LEVELS.CMD);
    setHistory(h => [trimmed, ...h].slice(0, 50));
    setHistIdx(-1);

    // Built-in: help
    if (trimmed.toLowerCase() === 'help') {
      getAllCommands().forEach(cmd => {
        con.log(`  ${cmd.name.padEnd(12)} — ${cmd.description}  (usage: ${cmd.usage})`);
      });
      return;
    }

    const cmd = getCommand(trimmed);
    if (!cmd) {
      con.error(`Unknown command: "${trimmed.split(' ')[0]}". Type "help" for commands.`);
      return;
    }

    try {
      cmd.run({ console: con, appState, setAppState, rawInput: trimmed });
    } catch (err) {
      con.error(`Command error: ${err.message}`);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      runInput(input);
      setInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const idx = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(idx);
      setInput(history[idx] ?? '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const idx = Math.max(histIdx - 1, -1);
      setHistIdx(idx);
      setInput(idx === -1 ? '' : history[idx]);
    }
  };

  return (
    <div
      className="rounded-xl overflow-hidden shadow-2xl border border-gray-700 flex"
      style={{ width: 640, background: bg }}
    >
      {/* ── Main terminal area ── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Title bar */}
        <div className="flex items-center justify-between px-3 py-2 bg-gray-800 drag-handle select-none">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500" />
            <span className="w-3 h-3 rounded-full bg-yellow-400" />
            <span className="w-3 h-3 rounded-full bg-green-500" />
            <span className="ml-2 text-xs text-gray-400 font-mono">TimesPast Console</span>
          </div>
          <Grab className="w-4 h-4 text-gray-500" />
        </div>

        {/* Output area */}
        <div
          className={`flex-1 overflow-y-auto px-3 py-2 ${font} ${size} leading-relaxed`}
          style={{ minHeight: 260, maxHeight: 400, color: fg }}
          onClick={() => inputRef.current?.focus()}
        >
          {con.lines.map(line => (
            <div key={line.id} className="flex gap-2 items-start break-all">
              <span className={`flex-shrink-0 ${LEVEL_COLORS[line.level]} opacity-70 select-none`}>
                {LEVEL_PREFIX[line.level]}
              </span>
              <span className={`${LEVEL_COLORS[line.level]} whitespace-pre-wrap`}>
                {line.text}
              </span>
              <span className="ml-auto flex-shrink-0 text-gray-600 text-[9px] select-none">
                {line.ts.toLocaleTimeString()}
              </span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input row */}
        <div
          className={`flex items-center gap-2 px-3 py-2 border-t border-gray-700 ${font} ${size}`}
          style={{ background: bg }}
        >
          <span style={{ color: fg }} className="opacity-60 select-none">$</span>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent outline-none"
            style={{ color: fg, caretColor: fg }}
            placeholder="type a command…"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </div>

      {/* ── Right sidebar: appearance controls ── */}
      <div className="flex flex-col gap-4 px-2 py-3 bg-gray-900 border-l border-gray-700 w-28 flex-shrink-0 overflow-y-auto">

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
          <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Text</p>
          {FG_COLORS.map(c => (
            <button key={c.value} onClick={() => setFg(c.value)}
              className="flex items-center gap-1.5 w-full text-left text-[10px] px-1 py-0.5 rounded mb-0.5 hover:bg-gray-700 transition-colors">
              <span className="w-3 h-3 rounded-full flex-shrink-0 border border-gray-600"
                style={{ background: c.value }} />
              <span className="text-gray-400">{c.label}</span>
            </button>
          ))}
        </section>

        <section>
          <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Background</p>
          {BG_COLORS.map(c => (
            <button key={c.value} onClick={() => setBg(c.value)}
              className="flex items-center gap-1.5 w-full text-left text-[10px] px-1 py-0.5 rounded mb-0.5 hover:bg-gray-700 transition-colors">
              <span className="w-3 h-3 rounded-full flex-shrink-0 border border-gray-600"
                style={{ background: c.value }} />
              <span className="text-gray-400">{c.label}</span>
            </button>
          ))}
        </section>

      </div>
    </div>
  );
}
