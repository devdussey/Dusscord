const { buildSetCommand } = require('../utils/streamLogCommandFactory');

module.exports = buildSetCommand({
  commandName: 'logserverset',
  description: 'Set the channel where server stream logs are sent',
  category: 'server',
  label: 'Server',
});
