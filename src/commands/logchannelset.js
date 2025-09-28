const { buildSetCommand } = require('../utils/streamLogCommandFactory');

module.exports = buildSetCommand({
  commandName: 'logchannelset',
  description: 'Set the channel where channel stream logs are sent',
  category: 'channels',
  label: 'Channel',
});
