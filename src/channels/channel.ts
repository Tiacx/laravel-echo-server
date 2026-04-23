import { PresenceChannel } from './presence-channel';
import { PrivateChannel } from './private-channel';
import { Log } from './../log';

export class Channel {
    /**
     * Channels and patters for private channels.
     */
    protected _privateChannels: string[] = ['private-*', 'presence-*'];

    /**
     * Allowed client events
     */
    protected _clientEvents: string[] = ['client-*'];

    /**
     * Private channel instance.
     */
    private: PrivateChannel;

    /**
     * Presence channel instance.
     */
    presence: PresenceChannel;

    /**
     * Regex cache for channel matching
     */
    private _privateRegex: RegExp[];
    private _clientEventRegex: RegExp[];

    /**
     * Create a new channel instance.
     */
    constructor(private io, private options) {
        this.private = new PrivateChannel(options);
        this.presence = new PresenceChannel(io, options);

        // Pre-compile regex patterns for better performance
        this._privateRegex = this._privateChannels.map(p => new RegExp(p.replace('\*', '.*')));
        this._clientEventRegex = this._clientEvents.map(e => new RegExp(e.replace('\*', '.*')));

        if (this.options.devMode) {
            Log.success('Channels are ready.');
        }
    }

    /**
     * Join a channel.
     */
    join(socket, data): void {
        try {
            if (data && data.channel) {
                if (this.isPrivate(data.channel)) {
                    this.joinPrivate(socket, data);
                } else {
                    socket.join(data.channel);
                    this.onJoin(socket, data.channel);
                }
            }
        } catch (error) {
            Log.error('Error joining channel: ' + error.message);
        }
    }

    /**
     * Trigger a client message
     */
    clientEvent(socket, data): void {
        try {
            if (typeof data === 'string') {
                try {
                    data = JSON.parse(data);
                } catch (e) {
                    // Keep original string if not valid JSON
                }
            }

            if (data && data.event && data.channel) {
                if (this.isClientEvent(data.event) &&
                    this.isPrivate(data.channel) &&
                    this.isInChannel(socket, data.channel)) {
                    const socketInstance = this.io.sockets.sockets.get(socket.id);
                    if (socketInstance) {
                        socketInstance.broadcast.to(data.channel)
                            .emit(data.event, data.channel, data.data);
                    }
                }
            }
        } catch (error) {
            Log.error('Error handling client event: ' + error.message);
        }
    }

    /**
     * Leave a channel.
     */
    leave(socket: any, channel: string, reason: string): void {
        if (channel) {
            try {
                if (this.isPresence(channel)) {
                    this.presence.leave(socket, channel);
                }

                socket.leave(channel);

                if (this.options.devMode) {
                    Log.info(`[${new Date().toISOString()}] - ${socket.id} left channel: ${channel} (${reason})`);
                }
            } catch (error) {
                Log.error('Error leaving channel: ' + error.message);
            }
        }
    }

    /**
     * Check if the incoming socket connection is a private channel.
     */
    isPrivate(channel: string): boolean {
        return this._privateRegex.some(regex => regex.test(channel));
    }

    /**
     * Join private channel, emit data to presence channels.
     */
    joinPrivate(socket: any, data: any): void {
        this.private.authenticate(socket, data).then(res => {
            socket.join(data.channel);

            if (this.isPresence(data.channel)) {
                let member = res.channel_data;
                try {
                    member = JSON.parse(res.channel_data);
                } catch (e) { }

                this.presence.join(socket, data.channel, member);
            }

            this.onJoin(socket, data.channel);
        }).catch(error => {
            if (this.options.devMode) {
                Log.error(error.reason || error);
            }

            const socketInstance = this.io.sockets.to(socket.id);
            if (socketInstance) {
                socketInstance.emit('subscription_error', data.channel, error.status || 500);
            }
        });
    }

    /**
     * Check if a channel is a presence channel.
     */
    isPresence(channel: string): boolean {
        return channel.lastIndexOf('presence-', 0) === 0;
    }

    /**
     * On join a channel log success.
     */
    onJoin(socket: any, channel: string): void {
        if (this.options.devMode) {
            Log.info(`[${new Date().toISOString()}] - ${socket.id} joined channel: ${channel}`);
        }
    }

    /**
     * Check if client is a client event
     */
    isClientEvent(event: string): boolean {
        return this._clientEventRegex.some(regex => regex.test(event));
    }

    /**
     * Check if a socket has joined a channel.
     */
    isInChannel(socket: any, channel: string): boolean {
        return !!socket.rooms[channel];
    }
}
