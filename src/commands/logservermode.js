const { buildModeCommand } = require('../utils/streamLogCommandFactory');

module.exports = buildModeCommand({
  commandName: 'logservermode',
  description: 'Enable or disable server stream logs',
  category: 'server',
  label: 'Server',
});
