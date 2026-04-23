import { DatabaseDriver } from './database-driver';
var Redis = require('ioredis');
import { Log } from './../log';

export class RedisDatabase implements DatabaseDriver {
    /**
     * Redis client.
     */
    private _redis: any;

    /**
     * Create a new cache instance.
     */
    constructor(private options) {
        // Merge with default options for better connection handling
        const redisOptions = {
            retryStrategy: (times) => {
                const delay = Math.min(times * 100, 3000);
                Log.warning(`Redis reconnecting in ${delay}ms (attempt ${times})`);
                return delay;
            },
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            connectTimeout: 10000,
            // Enable automatic reconnection
            ...options.databaseConfig.redis,
        };

        this._redis = new Redis(redisOptions);

        // Set up error handling
        this._redis.on('error', (error) => {
            if (error.code === 'ECONNRESET') {
                Log.warning('Redis connection reset, will retry...');
            } else {
                Log.error('Redis database error: ' + error.message);
            }
        });

        this._redis.on('connect', () => {
            Log.success('Redis database connected');
        });

        this._redis.on('ready', () => {
            Log.success('Redis database ready');
        });

        this._redis.on('reconnecting', () => {
            Log.warning('Redis reconnecting...');
        });

        this._redis.on('close', () => {
            Log.warning('Redis connection closed');
        });
    }

    /**
     * Check if Redis is connected and ready
     */
    private isReady(): boolean {
        return this._redis && this._redis.status === 'ready';
    }

    /**
     * Retrieve data from redis.
     */
    get(key: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            if (!this.isReady()) {
                Log.warning('Redis not ready, skipping get operation');
                resolve(null);
                return;
            }

            this._redis.get(key)
                .then(value => {
                    if (value === null) {
                        resolve(null);
                    } else {
                        try {
                            resolve(JSON.parse(value));
                        } catch (e) {
                            Log.error('Error parsing Redis data: ' + e.message);
                            resolve(null);
                        }
                    }
                })
                .catch(error => {
                    Log.error('Redis get error: ' + error.message);
                    reject(error);
                });
        });
    }

    /**
     * Store data to cache.
     */
    set(key: string, value: any): void {
        if (!this.isReady()) {
            Log.warning('Redis not ready, skipping set operation');
            return;
        }

        try {
            this._redis.set(key, JSON.stringify(value)).catch(error => {
                Log.error('Redis set error: ' + error.message);
            });

            if (this.options.databaseConfig.publishPresence === true && /^presence-.*:members$/.test(key)) {
                this._redis.publish('PresenceChannelUpdated', JSON.stringify({
                    "event": {
                        "channel": key,
                        "members": value
                    }
                })).catch(error => {
                    Log.error('Redis publish error: ' + error.message);
                });
            }
        } catch (error) {
            Log.error('Error storing data to Redis: ' + error.message);
        }
    }
}
