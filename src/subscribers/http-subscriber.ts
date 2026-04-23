import { Log } from './../log';
import { Subscriber } from './subscriber';
var url = require('url');

export class HttpSubscriber implements Subscriber {
    /**
     * Create new instance of http subscriber.
     *
     * @param  {any} express
     */
    constructor(private express, private options) { }

    /**
     * Subscribe to events to broadcast.
     *
     * @return {void}
     */
    subscribe(callback): Promise<any> {
        return new Promise((resolve, reject) => {
            // Broadcast a message to a channel
            this.express.post('/apps/:appId/events', (req, res) => {
                let body: any = [];

                req.on('error', (error) => {
                    Log.error('HTTP request error: ' + error.message);
                    res.statusCode = 400;
                    res.json({ error: 'Bad request' });
                });

                res.on('error', (error) => {
                    Log.error('HTTP response error: ' + error.message);
                });

                req.on('data', (chunk) => {
                    // Limit body size to prevent memory attacks
                    if (body.length > 100 || Buffer.concat(body).length > 1024 * 1024) {
                        res.statusCode = 413;
                        res.json({ error: 'Payload too large' });
                        req.destroy();
                        return;
                    }
                    body.push(chunk);
                })
                    .on('end', () => this.handleData(req, res, body, callback));
            });

            Log.success('Listening for http events...');

            resolve();
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
                this.express.post('/apps/:appId/events', (req, res) => {
                    res.status(404).send();
                });
                resolve();
            } catch(e) {
                reject('Could not overwrite the event endpoint -> ' + e);
            }
        });
    }

    /**
     * Handle incoming event data.
     *
     * @param  {any} req
     * @param  {any} res
     * @param  {any} body
     * @param  {Function} broadcast
     * @return {boolean}
     */
    handleData(req, res, body, broadcast): boolean {
        try {
            body = JSON.parse(Buffer.concat(body).toString());
        } catch (e) {
            return this.badResponse(req, res, 'Invalid JSON body');
        }

        if ((body.channels || body.channel) && body.name && body.data) {

            var data = body.data;
            try {
                data = JSON.parse(data);
            } catch (e) { }

            var message = {
                event: body.name,
                data: data,
                socket: body.socket_id
            }
            var channels = body.channels || [body.channel];

            if (this.options.devMode) {
                Log.info("Channel: " + channels.join(', '));
                Log.info("Event: " + message.event);
            }

            try {
                channels.forEach(channel => broadcast(channel, message));
            } catch (e) {
                Log.error('Broadcast error: ' + e.message);
                return this.badResponse(req, res, 'Broadcast failed');
            }
        } else {
            return this.badResponse(
                req,
                res,
                'Event must include channel, event name and data'
            );
        }

        res.json({ message: 'ok' })
    }

    /**
     * Handle bad requests.
     *
     * @param  {any} req
     * @param  {any} res
     * @param  {string} message
     * @return {boolean}
     */
    badResponse(req: any, res: any, message: string): boolean {
        res.statusCode = 400;
        res.json({ error: message });

        return false;
    }
}
