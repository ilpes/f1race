import {
    FastifyInstance,
    FastifyPluginOptions, FastifyRequest
} from "fastify";
import {Server, ServerOptions, Socket} from "socket.io";
import Redis from "ioredis";
import fp from 'fastify-plugin'
import path from "node:path";
import Redlock from "redlock";
import {fastifyCookie} from "@fastify/cookie";
import {fastifySession} from "@fastify/session";
import {fastifyStatic} from "@fastify/static";
import {fastifyCsrfProtection} from "@fastify/csrf-protection";
import RacesService, {
    DriverData,
    DriverPosition,
    MAX_DRIVER_PER_RACE,
    RaceStatus
} from "./services/races/service";
import ApiRoutes from "./api/routes";
import WebRoutes from "./web/routes";

declare module 'fastify' {
    export interface FastifyInstance {
        io: Server,
        redis: Redis,
        locker: Redlock,
        racesService: RacesService,
    }
}

declare module 'socket.io' {
    export interface Socket {
        sessionId: null | string,
        raceId: null | string,
        position: null | number;
    }
}

const io = fp(async (fastify: FastifyInstance, options: FastifyPluginOptions) => {


    const connect = () => {

        const racesNamespace = fastify.io.of('/races');
        const visitorsNamespace = fastify.io.of('/visitors');

        const updateDriversCount = () => {
            visitorsNamespace.emit('driver-count-update', racesNamespace.sockets.size);
        }

        visitorsNamespace.on('connection', (socket: any) => {
              updateDriversCount();
        });

        racesNamespace.use(async (socket: Socket, next) => {

            if(!socket.handshake.headers.cookie) {
                next(new Error('Cannot enter this race'));
                return;
            }

            const cookies = fastify.parseCookie(socket.handshake.headers.cookie);
            const encryptedSessionId = cookies.sessionId;
            const request = {session: null} as unknown as FastifyRequest;
            let sessionId: string = '';
            fastify.decryptSession(encryptedSessionId, request as FastifyRequest, () => {
                sessionId = request.session.sessionId;
            });

            const {raceId, position} = socket.handshake.auth;
            console.log(`sessionId: ${sessionId}`, `position: ${position}`, `raceId: ${raceId}`);

            const hasJoined = await fastify.racesService.hasJoinedAtPosition(raceId, sessionId, position);
            if (!hasJoined) {
                next(new Error('Cannot enter this race'));
                return;
            }

            socket.sessionId = sessionId;
            socket.raceId = raceId;
            socket.position = position;

            next();
        })

        racesNamespace.on("connection", async (socket: any) => {

            const onDriverSpeedUp = async (driverNumber: number) => {
                racesNamespace.in(socket.raceId).emit('driver-sped-up', driverNumber);
            }

            const onDriverBrake = async (driverNumber: number) => {
                racesNamespace.in(socket.raceId).emit('driver-braked', driverNumber);
            }
            // const onDriverDisconnected = async (reason: any) => {
            //     updateDriversCount();
            //
            //     // Update the driver's status...
            //     await fastify.racesService.disconnect(socket.raceId, socket.sessionId)
            //
            //     // Notify the room about the disconnection...
            //     socket
            //         .broadcast
            //         .to(socket.raceId)
            //         .emit("driver-disconnected", {position: socket.position});
            // }
            //
            // const onFinish = async () => {
            //     // @todo: eventually notify other clients...
            //
            //     const result = await fastify.racesService.finish(socket.raceId, socket.sessionId);
            //     socket.emit('finished', result);
            // }

            // const onDriverUpdate = async (data: DriverPosition) => {
            //     socket
            //         .broadcast
            //         .to(socket.raceId)
            //         .emit("driver-update", {
            //             position: socket.position,
            //             data: data,
            //         });
            //
            //     await fastify.racesService.update(socket.raceId, socket.sessionId, data);
            // }

            const onDriverConnected = async () => {
                const shouldStart: boolean = await fastify.racesService.shouldStart(socket.raceId);

                if (!shouldStart) {
                    return;
                }

                // Starting...
                await fastify.racesService.starting(socket.raceId);
                racesNamespace.in(socket.raceId).emit('starting');

                // And then start...
                setTimeout(async () => {
                    const canStart: boolean = await fastify.racesService.canStart(socket.raceId);

                    if (!canStart) {
                        return;
                    }

                    await fastify.racesService.start(socket.raceId);
                    racesNamespace.in(socket.raceId).emit('start');
                }, 5000); // Starts after 5 seconds
            };

            const initialize = async () => {
                // Join the race room
                socket.join(socket.raceId);

                // Update the driver's status
                await fastify.racesService.connect(socket.raceId, socket.sessionId);

                // Emit the drivers' list (position and status)
                const drivers = await fastify.racesService.driversList(socket.raceId);
                const status: RaceStatus = await fastify.racesService.status(socket.raceId);
                //socket.emit('initialize', drivers, status);

                socket.on('speed-up',  onDriverSpeedUp);
                socket.on('brake', onDriverBrake);
                //socket.on("disconnect",  onDriverDisconnected);

                racesNamespace.in(socket.raceId).emit('driver-connected', socket.position, drivers, status, onDriverConnected);

                // Update drivers' count
                updateDriversCount();
            }

            // const connectDriver = async ()  => {
            //     updateDriversCount();
            //
            //     const driverData = await fastify.racesService.driverData(socket.raceId, socket.sessionId);
            //
            //     racesNamespace.in(socket.raceId).emit('driver-connected', driverData, onDriverConnected);
            //
            //     // socket
            //     //     .broadcast
            //     //     .to(socket.raceId)
            //     //     .emit("driver-connected", driverData, onDriverConnected);
            // }

            await initialize();
            //await connectDriver();
        });
    }

    fastify.decorate('io', new Server(fastify.server, options as ServerOptions));
    fastify.addHook('onReady', connect);
});

const redis = fp(async (fastify: FastifyInstance, options: FastifyPluginOptions) => {
    const redis = new Redis(options);
    fastify.decorate('redis', redis);
    fastify.decorate('locker', new Redlock([redis]));

    const connect = async () => {
        const pong = await fastify.redis.ping();

        if (pong === 'PONG') {
            console.log('Redis connected');
            return;
        }

        throw `Could not connect to Redis...`;
    };

    fastify.addHook('onReady', connect);
    fastify.addHook('onClose', () => {
        fastify.redis.disconnect();
    });
});

const decorators = fp(async (fastify: FastifyInstance, options: FastifyPluginOptions) => {
    const racesService = new RacesService(fastify.redis, fastify.locker)
    fastify.decorate('racesService', racesService)
});


const app = async (fastify: FastifyInstance, options: FastifyPluginOptions) => {
    fastify.register(io, options.io);
    fastify.register(redis, options.redis);
    fastify.register(decorators);
    fastify.register(fastifyStatic, {
        root: path.join(__dirname, '../client/dist')
    });
    fastify.register(fastifyCookie, options.cookies);
    fastify.register(fastifySession, options.session);
    fastify.register(fastifyCsrfProtection);
    fastify.register(ApiRoutes, {prefix: '/api'});
    fastify.register(WebRoutes);
};

export default app;
