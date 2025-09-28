const SERVICE_DEFINITIONS = [
  {
    key: 'disboard',
    name: 'Disboard',
    defaultCommand: '!d bump',
    defaultIntervalMinutes: 120,
    description: 'Sends `!d bump` for the Disboard bot every 2 hours (Disboard cooldown).',
  },
  {
    key: 'discadia',
    name: 'Discadia',
    defaultCommand: '!bump',
    defaultIntervalMinutes: 120,
    description: 'Sends the Discadia bump command (default `!bump`) every 2 hours.',
  },
  {
    key: 'discords',
    name: 'Discords.com',
    defaultCommand: '!bump',
    defaultIntervalMinutes: 120,
    description: 'Triggers the discords.com bump command (default `!bump`) every 2 hours.',
  },
  {
    key: 'disforge',
    name: 'Disforge',
    defaultCommand: '!bump',
    defaultIntervalMinutes: 60,
    description: 'Sends the Disforge bump command (default `!bump`) every 60 minutes.',
  },
  {
    key: 'voidbots',
    name: 'Void Bots',
    defaultCommand: '!bump',
    defaultIntervalMinutes: 60,
    description: 'Sends the Void Bots bump command (default `!bump`) every 60 minutes.',
  },
  {
    key: 'custom',
    name: 'Custom / Other',
    defaultCommand: '',
    defaultIntervalMinutes: 120,
    description: 'Use this for other listing sites — provide your own command and interval.',
  },
];

function getService(key) {
  return SERVICE_DEFINITIONS.find(service => service.key === key) || null;
}

function getServiceChoices() {
  return SERVICE_DEFINITIONS.map(service => ({ name: service.name, value: service.key }));
}

function getDefaultIntervalMs(key) {
  const service = getService(key);
  if (!service) return 120 * 60 * 1000;
  const minutes = Number(service.defaultIntervalMinutes) || 120;
  return Math.max(60_000, minutes * 60 * 1000);
}

function getDefaultCommand(key) {
  const service = getService(key);
  return service?.defaultCommand || '';
}

module.exports = {
  SERVICE_DEFINITIONS,
  getService,
  getServiceChoices,
  getDefaultIntervalMs,
  getDefaultCommand,
};
