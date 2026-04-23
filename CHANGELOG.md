# 2.0.0

## Added
**EchoServer (`src/echo-server.ts`)**
- Added `.catch()` handlers to Promises to avoid unhandled promise rejections.
- Added `try/catch` wrappers around socket event handlers.
- Added enhanced error handling for `onConnect`, `onSubscribe`, `onUnsubscribe`, `onDisconnecting`, and `onClientEvent`.

**Server (`src/server.ts`)**
- Added global Express error-handling middleware for centralized 500 error handling.
- Added `express.json({ limit: '1mb' })` to restrict JSON payload size.
- Added `try/catch` around SSL file loading.
- Added `error` event listener on the HTTP server to handle port conflicts and other server errors.
- Added an `httpServer` reference to support proper resource cleanup.

**RedisSubscriber (`src/subscribers/redis-subscriber.ts`)**
- Added `connect`, `error`, `reconnecting`, and `close` event listeners to monitor connection state.
- Added improved error handling for `subscribe` and `unsubscribe`.

**HttpSubscriber (`src/subscribers/http-subscriber.ts`)**
- Added a request body size limit (max 1MB).
- Added `try/catch` around JSON parsing.
- Added error event listeners on request/response objects.
- Added improved exception handling in `handleData`.

**PresenceChannel (`src/channels/presence-channel.ts`)**
- Added a concurrency lock via `acquireLock()` to prevent race conditions.
- Added null/undefined checks for the `members` array.
- Added `.catch()` handlers to all database operations.

**Channel (`src/channels/channel.ts`)**
- Added cached/precompiled `_privateRegex` and `_clientEventRegex`.
- Added `try/catch` wrappers around all operations.
- Added existence checks for the `socket` instance before use.

**RedisDatabase (`src/database/redis.ts`)**
- Added `error` event listener on the Redis client.
- Added JSON parsing error handling for corrupted data.
- Added `.catch()` handlers to all Redis operations.

---

## Fixed
**EchoServer (`src/echo-server.ts`)**
- Fixed potential server crashes by preventing a single socket event handler error from affecting the whole server.
- Fixed unhandled promise rejection issues in event handling.

**Server (`src/server.ts`)**
- Fixed missing centralized handling of unexpected server errors (500).
- Fixed potential denial-of-service risk from unbounded JSON payloads.
- Fixed unhandled SSL file loading failures.
- Fixed missing handling of HTTP server errors such as port already in use.
- Fixed improper cleanup by ensuring `httpServer` is tracked.

**RedisSubscriber (`src/subscribers/redis-subscriber.ts`)**
- Fixed ungraceful shutdowns by using `quit()` instead of `disconnect()`.
- Fixed missing error handling during `subscribe`/`unsubscribe` operations.

**HttpSubscriber (`src/subscribers/http-subscriber.ts`)**
- Fixed potential memory abuse from large request bodies.
- Fixed crashes caused by malformed JSON in incoming requests.
- Fixed unhandled I/O errors on request/response streams.
- Fixed unhandled exceptions in `handleData`.

**PresenceChannel (`src/channels/presence-channel.ts`)**
- Fixed race conditions via a locking mechanism.
- Fixed deeply nested Promise chains by refactoring to `async/await` for more reliable error propagation.
- Fixed possible runtime errors due to missing or null `members` arrays.
- Fixed unhandled rejections from database operations.

**Channel (`src/channels/channel.ts`)**
- Fixed performance overhead from repeatedly creating regular expressions.
- Fixed inefficient checks in `isPrivate()` and `isClientEvent()` by using `Array.prototype.some()`.
- Fixed potential crashes by wrapping operations in `try/catch` and checking `socket` existence.

**RedisDatabase (`src/database/redis.ts`)**
- Fixed silent Redis connection failures by listening to `error` events.
- Fixed crashes caused by corrupted JSON data stored in Redis.
- Fixed unhandled promise rejections in Redis operations.

# 1.6.3

## Fixed

-   Security patch - update dependencies

# 1.6.2

## Added

-   Add method to stop the server (#502)[https://github.com/tlaverdure/laravel-echo-server/pull/502]
-   Document how to use Redis Sentinel (#437)[https://github.com/tlaverdure/laravel-echo-server/pull/437]
-   Add Apache proxt example tp docs (#361)[https://github.com/tlaverdure/laravel-echo-server/pull/361]
-   Expose user member user info in API. (#356)[https://github.com/tlaverdure/laravel-echo-server/pull/356]

## Fixed

-   Fix crash when invalid referer is sent (#513)[https://github.com/tlaverdure/laravel-echo-server/pull/513]

# 1.6.1

-   Update dependencies for security reasons.

# 1.6.0

Add support for Redis prefixing.

# 1.5.0

Add `stop` command

# 1.3.7

Allow variables in .env file to set options in the server configuration.

### Updates

-   Auth Host: `LARAVEL_ECHO_SERVER_AUTH_HOST` _Note_: This option will fall back to the `LARAVEL_ECHO_SERVER_HOST` option as the default if that is set in the .env file.

-   _Host_: `LARAVEL_ECHO_SERVER_HOST`

-   _Port_: `LARAVEL_ECHO_SERVER_PORT`

-   _Debug_: `LARAVEL_ECHO_SERVER_DEBUG`

# 1.3.3

Return a better error when member data is not present when joining presence channels.

# 1.3.2

Added CORS support to the HTTP API.

# 1.2.9

Updated to socket.io v2

# 1.2.0

## Upgrade Guide

-   Re-install laravel-echo-server globally using the command.

```
npm install -g laravel-echo-server
```

-   In your `laravel-echo-server.json` file, remove the section named `referrers`. Then follow the [instructions](https://github.com/tlaverdure/laravel-echo-server#api-clients) to generate an app id and key. The `referrers` section has been replaced with `clients`.
