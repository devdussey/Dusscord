const { buildModeCommand } = require('../utils/streamLogCommandFactory');

module.exports = buildModeCommand({
  commandName: 'logreactionmode',
  description: 'Enable or disable reaction stream logs',
  category: 'reactions',
  label: 'Reaction',
});
