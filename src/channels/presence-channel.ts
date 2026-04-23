import { Database } from './../database';
import { Log } from './../log';
var _ = require("lodash");

// In-memory lock to prevent race conditions on presence channel operations
const channelLocks = new Map<string, Promise<any>>();
const lockPromises = new Map<string, any>();

export class PresenceChannel {
    /**
     * Database instance.
     */
    db: Database;

    /**
     * Create a new Presence channel instance.
     */
    constructor(private io, private options: any) {
        this.db = new Database(options);
    }

    /**
     * Acquire a lock for channel operations to prevent race conditions.
     */
    private async acquireLock(channel: string): Promise<() => void> {
        while (lockPromises.has(channel)) {
            await lockPromises.get(channel);
        }

        let release: () => void;
        const lockPromise = new Promise<void>((resolve) => {
            release = resolve;
        });

        lockPromises.set(channel, lockPromise);

        return () => {
            lockPromises.delete(channel);
            release!();
        };
    }

    /**
     * Get the members of a presence channel.
     */
    getMembers(channel: string): Promise<any> {
        return this.db.get(channel + ":members");
    }

    /**
     * Check if a user is on a presence channel.
     */
    isMember(channel: string, member: any): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this.getMembers(channel).then(
                (members) => {
                    this.removeInactive(channel, members, member).then(
                        (members: any) => {
                            if (!members || !Array.isArray(members)) {
                                resolve(false);
                                return;
                            }
                            let search = members.filter(
                                (m) => m.user_id == member.user_id
                            );

                            if (search && search.length) {
                                resolve(true);
                            }

                            resolve(false);
                        }
                    );
                },
                (error) => {
                    Log.error(error);
                    resolve(false);
                }
            );
        });
    }

    /**
     * Remove inactive channel members from the presence channel.
     */
    removeInactive(channel: string, members: any[], member: any): Promise<any> {
        return new Promise((resolve, reject) => {
            this.io
                .of("/")
                .in(channel)
                .allSockets()
                .then((clients) => {
                    members = members || [];
                    members = members.filter((member) => {
                        return clients.has(member.socketId);
                    });

                    this.db.set(channel + ":members", members);

                    resolve(members);
                })
                .catch((error) => {
                    Log.error('Error removing inactive members: ' + error.message);
                    resolve(members || []);
                });
        });
    }

    /**
     * Join a presence channel and emit that they have joined only if it is the
     * first instance of their presence.
     */
    async join(socket: any, channel: string, member: any) {
        if (!member) {
            if (this.options.devMode) {
                Log.error(
                    "Unable to join channel. Member data for presence channel missing"
                );
            }

            return;
        }

        const releaseLock = await this.acquireLock(channel);

        try {
            const isMember = await this.isMember(channel, member);
            const members = (await this.getMembers(channel)) || [];

            member.socketId = socket.id;
            members.push(member);

            this.db.set(channel + ":members", members);

            const uniqueMembers = _.uniqBy(members.reverse(), "user_id") || [];

            this.onSubscribed(socket, channel, uniqueMembers);

            if (!isMember) {
                this.onJoin(socket, channel, member);
            }
        } catch (error) {
            Log.error('Error joining presence channel: ' + error.message);
        } finally {
            releaseLock();
        }
    }

    /**
     * Remove a member from a presenece channel and broadcast they have left
     * only if not other presence channel instances exist.
     */
    async leave(socket: any, channel: string): Promise<void> {
        const releaseLock = await this.acquireLock(channel);

        try {
            const members = (await this.getMembers(channel)) || [];
            let member = members.find(
                (member) => member.socketId == socket.id
            );

            if (!member) {
                return;
            }

            const filteredMembers = members.filter((m) => m.socketId != member.socketId);
            this.db.set(channel + ":members", filteredMembers);

            const stillMember = await this.isMember(channel, member);
            if (!stillMember) {
                delete member.socketId;
                this.onLeave(channel, member);
            }
        } catch (error) {
            Log.error('Error leaving presence channel: ' + error.message);
        } finally {
            releaseLock();
        }
    }

    /**
     * On join event handler.
     */
    onJoin(socket: any, channel: string, member: any): void {
        this.io.sockets.sockets.get(socket.id)
            .broadcast.to(channel)
            .emit("presence:joining", channel, member);
    }

    /**
     * On leave emitter.
     */
    onLeave(channel: string, member: any): void {
        this.io.to(channel).emit("presence:leaving", channel, member);
    }

    /**
     * On subscribed event emitter.
     */
    onSubscribed(socket: any, channel: string, members: any[]) {
        this.io.to(socket.id).emit("presence:subscribed", channel, members);
    }
}
