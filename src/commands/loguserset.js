const { buildSetCommand } = require('../utils/streamLogCommandFactory');

module.exports = buildSetCommand({
  commandName: 'loguserset',
  description: 'Set the channel where user stream logs are sent',
  category: 'users',
  label: 'User',
});
