import { useCallback } from 'react';
import { useConsole, LEVELS } from '@/components/console/ConsoleContext';
import { getCommand, getAllCommands } from '@/components/console/commands';

/**
 * Returns runCommand(rawString, { ask? }).
 * `ask` is optional — ConsolePanel passes its own interactive version;
 * URL-params / WebSocket calls omit it and get auto-select behaviour.
 */
export function useCommandRunner({ appState, setAppState, handlers }) {
  const con = useConsole();

  return useCallback(async (raw, { ask = null } = {}) => {
    const trimmed = raw?.trim();
    if (!trimmed) return;

    con.push(trimmed, LEVELS.CMD);

    if (trimmed.toLowerCase() === 'help') {
      con.log('Available commands:');
      getAllCommands().forEach(cmd =>
        con.log(`  ${cmd.name.padEnd(12)} ${cmd.description}   usage: ${cmd.usage}`)
      );
      return;
    }

    const cmd = getCommand(trimmed);
    if (!cmd) {
      con.error(`Unknown command: "${trimmed.split(' ')[0]}". Type "help".`);
      return;
    }

    try {
      await cmd.run({ console: con, appState, setAppState, handlers, rawInput: trimmed, ask });
    } catch (err) {
      con.error(`Command error: ${err.message}`);
    }
  }, [con, appState, setAppState, handlers]);
}
