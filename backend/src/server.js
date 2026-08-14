import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';

// How long a shutdown may take before we stop being polite about it. Platforms
// send SIGTERM and then SIGKILL a short while later, so this has to be well
// inside their window or the process is killed mid-write anyway.
const SHUTDOWN_GRACE_MS = 15_000;

async function start() {
  await connectDatabase();

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    console.log(`Lakshya API listening on port ${env.PORT} (${env.NODE_ENV})`);
  });

  // A tutor reply can take twenty seconds, so the socket timeout has to clear
  // that comfortably. Keep-alive sits under the header timeout on purpose:
  // reversed, a proxy can reuse a connection the instant we close it and the
  // client sees a random 502.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 70_000;
  server.requestTimeout = 120_000;

  let shuttingDown = false;

  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`${signal} received — finishing in-flight requests.`);

    // Stop accepting new connections, let the open ones finish, then close the
    // database. A request part-way through writing a plan gets to finish.
    const forced = setTimeout(() => {
      console.error('Shutdown took too long. Exiting anyway.');
      process.exit(1);
    }, SHUTDOWN_GRACE_MS);

    forced.unref();

    server.close(async () => {
      try {
        await disconnectDatabase();
      } catch (error) {
        console.error('Failed to close the database cleanly.', error);
      }

      console.log('Shutdown complete.');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // A rejection nobody caught is a bug, but it is not a reason to drop the
  // requests currently in flight. Log it and keep serving.
  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled promise rejection:', reason);
  });

  // An uncaught exception is different: the process is now in an unknown state
  // and anything it does next is guesswork. Shut down cleanly and let the
  // platform start a fresh one.
  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception — shutting down.', error);
    shutdown('uncaughtException');
  });
}

start().catch((error) => {
  console.error('The server failed to start.', error);
  process.exit(1);
});
