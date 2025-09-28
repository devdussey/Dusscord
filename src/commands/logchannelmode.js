const { buildModeCommand } = require('../utils/streamLogCommandFactory');

module.exports = buildModeCommand({
  commandName: 'logchannelmode',
  description: 'Enable or disable channel stream logs',
  category: 'channels',
  label: 'Channel',
});
