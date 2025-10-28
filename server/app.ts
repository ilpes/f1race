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
import RacesService from "./game/RaceService";
import ApiRoutes from "./api/routes";
import WebRoutes from "./web/routes";
import * as fs from "node:fs";
import {MAX_DRIVER_PER_RACE, RaceManager, RaceState} from "./game/RaceManager";
import {GameState, PlayerInput} from "./game/GameEngine";

declare module 'fastify' {
    export interface FastifyInstance {
        io: Server,
        redis: Redis,
        locker: Redlock,
        racesService: RacesService,
        raceManager: RaceManager,
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

            const onPlayerInput = async (input: PlayerInput) => {
                fastify.raceManager.queueInput(socket.raceId, input);
            }

            const onRaceUpdate = (raceId: string, gameState: GameState) => {
                racesNamespace.in(raceId).emit('game-state', gameState);
            }

            const onRaceFinished = (raceId: string, time: number) => {
                fastify.racesService.finish(raceId, time);
                racesNamespace.in(socket.raceId).emit('finished');
            }

            const startRace = async (raceId: string) => {

                fastify.raceManager.starting(raceId);
                racesNamespace.in(socket.raceId).emit('starting');

                setTimeout(async () => {
                    fastify.raceManager.startRace(raceId);
                    await fastify.racesService.start(raceId, Number(fastify.raceManager.getStartedAt(raceId)));

                    racesNamespace.in(socket.raceId).emit('start');
                }, 2000);
            }

            const shouldStartRace = (raceState: RaceState) => {
                return raceState.status === 'waiting' && raceState.driverCount === MAX_DRIVER_PER_RACE
            }

            const connectDriver = (position: number, state: RaceState) => {
                racesNamespace.in(socket.raceId).emit('driver-connected', position, state);
            }

            const disconnectDriver = (position: number) => {
                racesNamespace.in(socket.raceId).emit('driver-disconnected', position);
            }

            const initialize = async () => {
                // Join the race and listen for events
                socket.join(socket.raceId);
                socket.on('input', onPlayerInput);
                socket.on('disconnect', onDisconnect);

                // Update players count
                updateDriversCount();

                // Get or create race in game engine
                let race = fastify.raceManager.getRace(socket.raceId);
                if (!race) {
                    fastify.raceManager.createRace(
                        socket.raceId,
                        MAX_DRIVER_PER_RACE,
                        onRaceUpdate,
                        onRaceFinished,
                    );
                }

                fastify.raceManager.addDriverToRace(socket.raceId, socket.position);

                const raceState = fastify.raceManager.raceState(socket.raceId);
                if (!raceState) {
                    console.log('Something went wrong');
                    return;
                }

                connectDriver(socket.position, raceState);

                // All the players are there, let's start
                if (shouldStartRace(raceState)) {
                    await startRace(socket.raceId);
                }
            }

            const onDisconnect = async (reason: any) => {
                updateDriversCount();

                fastify.raceManager.disconnectDriverFromRace(socket.raceId, socket.position);
                disconnectDriver(socket.position);
            }

            await initialize();
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
    const trackDataPath = path.join(__dirname, 'game/tracks', 'track.json');
    const trackData = JSON.parse(fs.readFileSync(trackDataPath, 'utf-8'));

    const raceManager = new RaceManager(trackData);
    const racesService = new RacesService(fastify.redis, fastify.locker)
    fastify.decorate('racesService', racesService)
    fastify.decorate('raceManager', raceManager);

    fastify.addHook('onClose', () => {
        fastify.raceManager.shutdown();
    });
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
