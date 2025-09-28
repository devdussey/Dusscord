const { buildModeCommand } = require('../utils/streamLogCommandFactory');

module.exports = buildModeCommand({
  commandName: 'logsecuritymode',
  description: 'Enable or disable security stream logs',
  category: 'security',
  label: 'Security',
});
