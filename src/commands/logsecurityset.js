const { buildSetCommand } = require('../utils/streamLogCommandFactory');

module.exports = buildSetCommand({
  commandName: 'logsecurityset',
  description: 'Set the channel where security stream logs are sent',
  category: 'security',
  label: 'Security',
});
