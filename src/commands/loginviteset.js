const { buildSetCommand } = require('../utils/streamLogCommandFactory');

module.exports = buildSetCommand({
  commandName: 'loginviteset',
  description: 'Set the channel where invite stream logs are sent',
  category: 'invites',
  label: 'Invite',
});
