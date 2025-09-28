const { buildSetCommand } = require('../utils/streamLogCommandFactory');

module.exports = buildSetCommand({
  commandName: 'logbotset',
  description: 'Set the channel where bot stream logs are sent',
  category: 'bot',
  label: 'Bot',
});
