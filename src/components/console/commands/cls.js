export default {
  name: 'cls',
  aliases: ['clear'],
  description: 'Clear the console.',
  usage: 'cls',
  run({ console: con }) {
    con.clear();
  },
};
