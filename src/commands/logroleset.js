const { buildSetCommand } = require('../utils/streamLogCommandFactory');

module.exports = buildSetCommand({
  commandName: 'logroleset',
  description: 'Set the channel where role stream logs are sent',
  category: 'roles',
  label: 'Role',
});
