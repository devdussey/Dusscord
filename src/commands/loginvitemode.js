const { buildModeCommand } = require('../utils/streamLogCommandFactory');

module.exports = buildModeCommand({
  commandName: 'loginvitemode',
  description: 'Enable or disable invite stream logs',
  category: 'invites',
  label: 'Invite',
});
