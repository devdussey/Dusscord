const { buildModeCommand } = require('../utils/streamLogCommandFactory');

module.exports = buildModeCommand({
  commandName: 'logbotmode',
  description: 'Enable or disable bot stream logs',
  category: 'bot',
  label: 'Bot',
});
