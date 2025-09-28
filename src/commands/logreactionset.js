const { buildSetCommand } = require('../utils/streamLogCommandFactory');

module.exports = buildSetCommand({
  commandName: 'logreactionset',
  description: 'Set the channel where reaction stream logs are sent',
  category: 'reactions',
  label: 'Reaction',
});
