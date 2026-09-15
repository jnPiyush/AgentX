const path = require('path');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');

const { createFrontierRunner } = require('./frontierRunner');
const { loadConfig } = require('./config');
const { startLoopWatcher } = require('./loopWatcher');
const { createMessageHandler } = require('./messageHandler');

function createBot({
  config = loadConfig(),
  ClientClass = Client,
  AuthClass = LocalAuth,
  runnerFactory = createFrontierRunner,
  watcherFactory = startLoopWatcher,
  handlerFactory = createMessageHandler,
} = {}) {
  const sessionRoot = path.resolve(__dirname, '..', '.wwebjs_auth');
  const runner = runnerFactory(config);
  const runtimeConfig = { ...config, runner };
  const clientOptions = {
    authStrategy: new AuthClass({ dataPath: sessionRoot }),
    puppeteer: { headless: config.browser.headless },
  };
  if (config.browser.executablePath) clientOptions.puppeteer.executablePath = config.browser.executablePath;

  const client = new ClientClass(clientOptions);
  const handler = handlerFactory(runtimeConfig);
  let watcher = null;
  let shutdownPromise = null;

  client.on('qr', (qr) => {
    console.log('\n[Frontier WhatsApp] Scan this QR with WhatsApp -> Linked Devices:');
    qrcode.generate(qr, { small: true });
  });
  client.on('authenticated', () => console.log('[Frontier WhatsApp] Authenticated.'));
  client.on('auth_failure', (message) => {
    console.error('[Frontier WhatsApp] Auth failure:', message);
    void shutdown();
  });
  client.on('ready', () => {
    console.log(`[Frontier WhatsApp] Ready. Allowed operators: ${config.allowedNumbers.length}`);
    watcher && watcher.stop();
    try { require('fs').chmodSync(sessionRoot, 0o700); } catch (error) {
      console.warn(`[Frontier WhatsApp] Could not restrict session permissions: ${error.message}`);
    }
    watcher = watcherFactory({ config, client });
  });
  client.on('message_create', (message) => {
    void handler(message).catch((error) => console.error('[Frontier WhatsApp] Handler error:', error.message));
  });
  client.on('disconnected', (reason) => {
    console.warn('[Frontier WhatsApp] Disconnected:', reason);
    watcher && watcher.stop();
    watcher = null;
  });

  const shutdown = () => {
    if (shutdownPromise) return shutdownPromise;
    shutdownPromise = (async () => {
      watcher && watcher.stop();
      await runner.stop();
      await client.destroy();
    })();
    return shutdownPromise;
  };

  return { client, config, handler, runner, shutdown, start: () => client.initialize() };
}

if (require.main === module) {
  let bot;
  try {
    bot = createBot();
    console.log('[Frontier WhatsApp] Starting...');
    bot.start().catch((error) => {
      console.error('[Frontier WhatsApp] Failed to initialize:', error.message);
      process.exitCode = 1;
    });
  } catch (error) {
    console.error('[Frontier WhatsApp] Configuration error:', error.message);
    process.exitCode = 1;
  }

  const stop = async () => {
    if (bot) await bot.shutdown().catch((error) => console.error('[Frontier WhatsApp] Shutdown error:', error.message));
  };
  process.once('SIGINT', () => { void stop().finally(() => process.exit()); });
  process.once('SIGTERM', () => { void stop().finally(() => process.exit()); });
}

module.exports = { createBot };
