const { buildModeCommand } = require('../utils/streamLogCommandFactory');

module.exports = buildModeCommand({
  commandName: 'logusermode',
  description: 'Enable or disable user stream logs',
  category: 'users',
  label: 'User',
});
