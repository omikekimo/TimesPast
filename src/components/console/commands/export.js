import { downloadJson }                    from '@/lib/fileUtils';
import { eventsToCSV, notesToCSVBlocks }   from '@/lib/csvExport';

const today = () => new Date().toISOString().split('T')[0];

async function promptFilename(ask, defaultName) {
  if (ask) return ask(`Filename (without extension) [${defaultName}]:`);
  return defaultName; // automated path — use default silently
}

export default {
  name:        'export',
  aliases:     ['exp'],
  description: 'Export data. Flags: -se session JSON · -csv spreadsheet · -con console log',
  usage:       'export <flag>  e.g. export -se  or  export -csv',

  async run({ console: con, appState, handlers, rawInput, ask }) {
    const parts = rawInput.trim().split(/\s+/);
    const flag  = parts[1];

    if (!flag) {
      con.log('Usage:  export <flag>');
      con.log('  -se   session JSON (all pins, notes, groups)');
      con.log('  -csv  spreadsheet CSV (pins + notes)');
      con.log('  -con  console log as .txt');
      return;
    }

    switch (flag) {

      case '-se': {
        const { events, notes, groups, activeLayers, timeRange } = appState;
        const defaultName = `timespast-session-${today()}`;
        const rawName     = await promptFilename(ask, defaultName);
        if (!rawName?.trim()) { con.warn('Export cancelled.'); return; }
        const filename = rawName.trim();

        const exportData = { events, notes, groups, activeLayers, timeRange,
          exportedAt: new Date().toISOString() };
        downloadJson(exportData, `${filename}.json`);
        con.success(`Session exported as ${filename}.json  (${events.length} pins, ${notes.length} notes)`);
        break;
      }

      case '-csv': {
        const { events, notes } = appState;
        const defaultName = `timespast-events-${today()}`;
        const rawName     = await promptFilename(ask, defaultName);
        if (!rawName?.trim()) { con.warn('Export cancelled.'); return; }
        const filename = rawName.trim();

        const eventCSV   = eventsToCSV(events);
        const noteBlocks = notesToCSVBlocks(notes);
        const full       = noteBlocks ? `${eventCSV}\n${noteBlocks}` : eventCSV;

        const blob = new Blob([full], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `${filename}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        con.success(`CSV exported as ${filename}.csv  (${events.length} rows, ${notes.length} notes)`);
        break;
      }

      case '-con': {
        const defaultName = `timespast-console-${today()}`;
        const rawName     = await promptFilename(ask, defaultName);
        if (!rawName?.trim()) { con.warn('Export cancelled.'); return; }
        const filename = rawName.trim();

        const text = con.lines
          .map(l => `[${l.ts.toISOString()}] [${l.level.toUpperCase()}] ${l.text}`)
          .join('\n');
        const blob = new Blob([text], { type: 'text/plain' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `${filename}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        con.success(`Console exported as ${filename}.txt`);
        break;
      }

      default:
        con.error(`Unknown flag "${flag}". Use: -se  -csv  -con`);
    }
  },
};
