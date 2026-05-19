export default {
  name: 'export',
  aliases: [],
  description: 'Download the console log as a .txt file.',
  usage: 'export',
  run({ console: con }) {
    const text = con.lines
      .map(l => `[${l.ts.toISOString()}] [${l.level.toUpperCase()}] ${l.text}`)
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `timespast-console-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    con.success('Console exported.');
  },
};
