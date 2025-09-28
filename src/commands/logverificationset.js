const { buildSetCommand } = require('../utils/streamLogCommandFactory');

module.exports = buildSetCommand({
  commandName: 'logverificationset',
  description: 'Set the channel where verification stream logs are sent',
  category: 'verification',
  label: 'Verification',
});
