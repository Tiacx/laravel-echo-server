var Redis = require('ioredis');
import { Log } from './../log';
import { Subscriber } from './subscriber';

export class RedisSubscriber implements Subscriber {
    /**
     * Redis pub/sub client.
     *
     * @type {object}
     */
    private _redis: any;

    /**
     *
     * KeyPrefix for used in the redis Connection
     *
     * @type {String}
     */
    private _keyPrefix: string;

    /**
     * Create a new instance of subscriber.
     *
     * @param {any} options
     */
    constructor(private options) {
        this._keyPrefix = options.databaseConfig.redis.keyPrefix || '';

        // Merge with default options for better connection handling
        const redisOptions = {
            retryStrategy: (times) => {
                const delay = Math.min(times * 100, 3000);
                Log.warning(`Redis subscriber reconnecting in ${delay}ms (attempt ${times})`);
                return delay;
            },
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            connectTimeout: 10000,
            ...options.databaseConfig.redis,
        };

        this._redis = new Redis(redisOptions);
        this.setupEventHandlers();
    }

    /**
     * Setup Redis event handlers for connection monitoring.
     */
    private setupEventHandlers(): void {
        this._redis.on('connect', () => {
            Log.success('Redis subscriber connected');
        });

        this._redis.on('error', (error) => {
            if (error.code === 'ECONNRESET') {
                Log.warning('Redis connection reset, will retry...');
            } else {
                Log.error('Redis subscriber error: ' + error.message);
            }
        });

        this._redis.on('reconnecting', () => {
            Log.warning('Redis subscriber reconnecting...');
        });

        this._redis.on('close', () => {
            Log.warning('Redis subscriber connection closed');
        });

        this._redis.on('ready', () => {
            Log.success('Redis subscriber ready');
        });
    }

    /**
     * Subscribe to events to broadcast.
     *
     * @return {Promise<any>}
     */
    subscribe(callback): Promise<any> {
        return new Promise((resolve, reject) => {
            this._redis.on('pmessage', (subscribed, channel, message) => {
                try {
                    message = JSON.parse(message);

                    if (this.options.devMode) {
                        Log.info("Channel: " + channel);
                        Log.info("Event: " + message.event);
                    }

                    callback(channel.substring(this._keyPrefix.length), message);
                } catch (e) {
                    if (this.options.devMode) {
                        Log.info("No JSON message");
                    }
                }
            });

            // Wait for ready event before subscribing
            this._redis.once('ready', () => {
                this.doSubscribe(callback, resolve, reject);
            });

            // Handle case where redis is already ready
            if (this._redis.status === 'ready') {
                this.doSubscribe(callback, resolve, reject);
            }
        });
    }

    /**
     * Actually perform the psubscribe
     */
    private doSubscribe(callback, resolve, reject): void {
        this._redis.psubscribe(`${this._keyPrefix}*`, (err, count) => {
            if (err) {
                Log.error('Redis could not subscribe: ' + err.message);
                reject('Redis could not subscribe.')
            } else {
                Log.success('Listening for redis events...');
                resolve();
            }
        });
    }

    /**
     * Unsubscribe from events to broadcast.
     *
     * @return {Promise}
     */
    unsubscribe(): Promise<any> {
        return new Promise((resolve, reject) => {
            try {
                this._redis.quit().then(() => {
                    Log.info('Redis subscriber disconnected gracefully');
                    resolve();
                }).catch((err) => {
                    Log.error('Error disconnecting from redis: ' + err.message);
                    resolve(); // Resolve anyway to allow shutdown
                });
            } catch(e) {
                reject('Could not disconnect from redis -> ' + e);
            }
        });
    }
}
