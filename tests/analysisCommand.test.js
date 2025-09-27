const test = require('node:test');
const assert = require('node:assert/strict');
const { ChannelType } = require('discord.js');
const path = require('node:path');

const storeModule = require('../src/utils/analysisConfigStore');
const commandPath = path.resolve(__dirname, '../src/commands/analysis.js');

function reimportCommand() {
  delete require.cache[commandPath];
  return require(commandPath);
}

function makeMessage(id, content, timestamp, authorName = 'Alpha') {
  return {
    id,
    content,
    createdTimestamp: timestamp,
    member: { displayName: authorName },
    author: { username: authorName, bot: false },
    attachments: new Map(),
  };
}

function makeInteraction(channel) {
  let reply;
  return {
    inGuild: () => true,
    guildId: 'guild1',
    user: {
      id: 'user1',
      username: 'Analyst',
      displayAvatarURL: () => null,
    },
    channel,
    options: {
      getInteger: () => null,
    },
    deferReply: () => Promise.resolve(),
    editReply: (data) => {
      reply = data;
      return Promise.resolve(data);
    },
    reply: (data) => {
      reply = data;
      return Promise.resolve(data);
    },
    getReply: () => reply,
  };
}

test('analysis command consumes a token and sends persona to API', async () => {
  const now = Date.now();
  const messages = [
    makeMessage('1', 'First message', now - 3000, 'Alpha'),
    makeMessage('2', 'Second message', now - 2000, 'Beta'),
  ];

  const channel = {
    type: ChannelType.GuildText,
    messages: {
      fetch: async ({ before }) => {
        if (before) return new Map();
        return new Map(messages.map((m) => [m.id, m]));
      },
    },
  };

  const consumeMock = test.mock.method(storeModule, 'consumeJudgementToken', async () => true);
  const refundMock = test.mock.method(storeModule, 'refundJudgementToken', async () => {});
  const personaMock = test.mock.method(storeModule, 'getPersona', () => 'Custom Persona');

  const originalEnv = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-key';

  const fetchCalls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    fetchCalls.push({ url, init });
    return {
      ok: true,
      text: async () => JSON.stringify({
        choices: [
          {
            message: {
              content: 'Overview:\nEverything looks good.',
            },
          },
        ],
      }),
    };
  };

  try {
    const command = reimportCommand();
    const interaction = makeInteraction(channel);
    await command.execute(interaction);

    assert.equal(consumeMock.mock.callCount(), 1);
    assert.equal(refundMock.mock.callCount(), 0);
    assert.equal(fetchCalls.length, 1);
    const body = JSON.parse(fetchCalls[0].init.body);
    assert.equal(body.messages[0].content, 'Custom Persona');
    assert.match(body.messages[1].content, /First message/);

    const reply = interaction.getReply();
    assert.ok(reply.embeds?.length); 
    assert.equal(reply.embeds[0].data.title, 'Conversation Analysis');
  } finally {
    consumeMock.mock.restore();
    refundMock.mock.restore();
    personaMock.mock.restore();
    globalThis.fetch = originalFetch;
    if (originalEnv === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalEnv;
    }
    delete require.cache[commandPath];
  }
});

test('analysis command refunds token on API failure', async () => {
  const now = Date.now();
  const channel = {
    type: ChannelType.GuildText,
    messages: {
      fetch: async () => new Map([
        ['1', makeMessage('1', 'Only message', now - 1000, 'Gamma')],
      ]),
    },
  };

  const consumeMock = test.mock.method(storeModule, 'consumeJudgementToken', async () => true);
  const refundMock = test.mock.method(storeModule, 'refundJudgementToken', async () => {});
  const personaMock = test.mock.method(storeModule, 'getPersona', () => null);

  const originalEnv = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-key';

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    text: async () => JSON.stringify({ error: { message: 'Model busy' } }),
  });

  try {
    const command = reimportCommand();
    const interaction = makeInteraction(channel);
    await command.execute(interaction);

    assert.equal(consumeMock.mock.callCount(), 1);
    assert.equal(refundMock.mock.callCount(), 1);
    const reply = interaction.getReply();
    assert.equal(reply, 'Analysis failed: Model busy');
  } finally {
    consumeMock.mock.restore();
    refundMock.mock.restore();
    personaMock.mock.restore();
    globalThis.fetch = originalFetch;
    if (originalEnv === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalEnv;
    }
    delete require.cache[commandPath];
  }
});
