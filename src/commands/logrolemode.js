const { buildModeCommand } = require('../utils/streamLogCommandFactory');

module.exports = buildModeCommand({
  commandName: 'logrolemode',
  description: 'Enable or disable role stream logs',
  category: 'roles',
  label: 'Role',
});
