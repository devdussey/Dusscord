const { buildSetCommand } = require('../utils/streamLogCommandFactory');

module.exports = buildSetCommand({
  commandName: 'logmessageset',
  description: 'Set the channel where message stream logs are sent',
  category: 'messages',
  label: 'Messages',
});
