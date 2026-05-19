import cls    from './cls.js';
import exportCmd from './export.js';

// Register commands here. Each file exports a command object:
// { name, aliases[], description, usage, run(context) }
// context = { console, appState, setAppState }
// Add new command files and import them above, then add to this array.

const COMMANDS = [cls, exportCmd];

// Build lookup map (name + all aliases)
const registry = new Map();
COMMANDS.forEach(cmd => {
  registry.set(cmd.name, cmd);
  cmd.aliases?.forEach(a => registry.set(a, cmd));
});

export function getCommand(input) {
  const [name] = input.trim().toLowerCase().split(/\s+/);
  return registry.get(name) || null;
}

export function getAllCommands() {
  // Return unique commands (no alias duplicates)
  return COMMANDS;
}
