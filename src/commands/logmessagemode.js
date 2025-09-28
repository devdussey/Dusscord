const { buildModeCommand } = require('../utils/streamLogCommandFactory');

module.exports = buildModeCommand({
  commandName: 'logmessagemode',
  description: 'Enable or disable message stream logs',
  category: 'messages',
  label: 'Message',
});
