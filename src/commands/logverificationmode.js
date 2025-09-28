const { buildModeCommand } = require('../utils/streamLogCommandFactory');

module.exports = buildModeCommand({
  commandName: 'logverificationmode',
  description: 'Enable or disable verification stream logs',
  category: 'verification',
  label: 'Verification',
});
