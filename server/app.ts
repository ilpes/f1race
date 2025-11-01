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
import {RaceManager} from "./game/RaceManager";
import {WarmupManager} from "./game/WarmupManager";
import WarmupService from "./game/WarmupService";
import {GameState, PlayerInput, RaceState} from "./types";
import {MAX_DRIVER_PER_RACE} from "./constants";

declare module 'fastify' {
    export interface FastifyInstance {
        io: Server,
        redis: Redis,
        locker: Redlock,
        racesService: RacesService,
        raceManager: RaceManager,
        warmupService: WarmupService,
        warmupManager: WarmupManager,
    }
}

declare module 'socket.io' {
    export interface Socket {
        sessionId: null | string,
        raceId: null | string,
        driverNumber: null | number;
        warmupId: null | string;
    }
}

const io = fp(async (fastify: FastifyInstance, options: FastifyPluginOptions) => {

    const connect = () => {

        const warmupsNamespace = fastify.io.of('/warmups')
        const racesNamespace = fastify.io.of('/races');
        const visitorsNamespace = fastify.io.of('/visitors');

        const updateDriversCount = () => {
            visitorsNamespace.emit('driver-count-update', racesNamespace.sockets.size);
        }

        visitorsNamespace.on('connection', (socket: any) => {
            updateDriversCount();
        });

        warmupsNamespace.on('connection', (socket: any) => {
            updateDriversCount();
        })

        warmupsNamespace.use(async (socket: Socket, next) => {
            if (!socket.handshake.headers.cookie) {
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

            const {warmupId} = socket.handshake.auth;
            const hasJoined = await fastify.warmupService.hasJoined(warmupId, sessionId);
            if (!hasJoined) {
                next(new Error('Cannot enter this warmup session'));
                return;
            }

            socket.sessionId = sessionId;
            socket.warmupId = warmupId;

            next();
        })

        racesNamespace.use(async (socket: Socket, next) => {

            if (!socket.handshake.headers.cookie) {
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

            const {raceId, driverNumber} = socket.handshake.auth;
            const hasJoined = await fastify.racesService.hasJoinedWithNumber(raceId, sessionId, driverNumber);
            if (!hasJoined) {
                next(new Error('Cannot enter this race'));
                return;
            }

            socket.sessionId = sessionId;
            socket.raceId = raceId;
            socket.driverNumber = driverNumber;

            next();
        })

        racesNamespace.on("connection", async (socket: any) => {

            const onPlayerInput = async (input: PlayerInput) => {
                fastify.raceManager.queueInput(socket.raceId, input);
            }

            const onRaceUpdate = (raceId: string, gameState: GameState) => {
                racesNamespace.in(raceId).emit('game-state', gameState);
            }

            const onRaceFinished = async (raceId: string, time: number) => {
                console.log('Race finished');
                const results = await fastify.racesService.finish(raceId, time);

                // Clean up the raceManager after 5 secs
                setTimeout(() => {
                    fastify.raceManager.removeRace(raceId);
                }, 5000);

                // Notify the room
                racesNamespace.in(socket.raceId).emit('finished', results);
            }

            const startRace = async (raceId: string) => {

                fastify.raceManager.starting(raceId);
                racesNamespace.in(socket.raceId).emit('starting');

                // Auto start after 2 sec
                setTimeout(async () => {
                    fastify.raceManager.startRace(raceId);
                    const startedAt = Number(fastify.raceManager.getStartedAt(raceId))
                    await fastify.racesService.start(raceId, startedAt);

                    racesNamespace.in(socket.raceId).emit('start');
                }, 2000);

                // Remove idle race after 30 min
                setTimeout(() => {
                    onRaceFinished(raceId, Date.now());
                }, 1_800_000);
            }

            const shouldStartRace = (raceState: RaceState) => {
                return raceState.status === 'waiting' && raceState.driverCount === MAX_DRIVER_PER_RACE
            }

            const connectDriver = (driverNumber: number, state: RaceState) => {
                racesNamespace.in(socket.raceId).emit('driver-connected', driverNumber, state);
            }

            const disconnectDriver = (driverNumber: number) => {
                racesNamespace.in(socket.raceId).emit('driver-disconnected', driverNumber);
            }

            const onDriverFinished = async (raceId: string, driverNumber: number, time: number) => {
                console.log('Driver finished');
                await fastify.racesService.saveResult(raceId, driverNumber, time);
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
                        onDriverFinished,
                    );
                }

                fastify.raceManager.addDriverToRace(socket.raceId, socket.driverNumber);

                const raceState = fastify.raceManager.raceState(socket.raceId);
                if (!raceState) {
                    console.log('Something went wrong');
                    return;
                }

                connectDriver(socket.driverNumber, raceState);

                // All the players are there, let's start
                if (shouldStartRace(raceState)) {
                    await startRace(socket.raceId);
                }
            }

            const onDisconnect = async (reason: any) => {
                updateDriversCount();

                fastify.raceManager.disconnectDriverFromRace(socket.raceId, socket.driverNumber);
                disconnectDriver(socket.driverNumber);
            }

            await initialize();
        });


        warmupsNamespace.on("connection", async (socket: any) => {

            const onPlayerInput = async (input: PlayerInput) => {
                fastify.warmupManager.queueInput(socket.warmupId, input);
            }

            const onRaceUpdate = (warmupId: string, gameState: GameState) => {
                warmupsNamespace.in(warmupId).emit('game-state', gameState);
            }

            const onRaceFinished = async (warmupId: string, time: number) => {
                const results = await fastify.warmupService.finish(warmupId, time);

                // Clean up the raceManager after 5 secs
                setTimeout(() => {
                    fastify.warmupManager.removeWarmup(warmupId);
                }, 5000);

                // Notify the room
                warmupsNamespace.in(socket.warmupId).emit('finished', results);
            }

            const startRace = async (warmupId: string) => {

                fastify.warmupManager.starting(warmupId);
                warmupsNamespace.in(socket.warmupId).emit('starting');

                // Auto start after 2 sec
                setTimeout(async () => {
                    fastify.warmupManager.startWarmup(warmupId);
                    await fastify.warmupService.start(warmupId, Number(fastify.warmupManager.getStartedAt(warmupId)));

                    warmupsNamespace.in(socket.warmupId).emit('start');
                }, 2000);

                // Remove idle race after 30 min
                setTimeout(() => {
                    onRaceFinished(warmupId, Date.now());
                }, 1_800_000);
            }

            const shouldStartRace = (raceState: RaceState) => {
                return raceState.status === 'waiting';
            }

            const connectDriver = (state: RaceState) => {
                warmupsNamespace.in(socket.warmupId).emit('driver-connected', state);
            }

            const disconnectDriver = () => {
                warmupsNamespace.in(socket.warmupId).emit('driver-disconnected');
            }

            const initialize = async () => {
                // Join the race and listen for events
                socket.join(socket.warmupId);
                socket.on('input', onPlayerInput);
                socket.on('disconnect', onDisconnect);

                // Update players count
                updateDriversCount();

                // Get or create race in game engine
                let race = fastify.warmupManager.getWarmup(socket.warmupId);
                if (!race) {
                    fastify.warmupManager.createWarmup(
                        socket.warmupId,
                        onRaceUpdate,
                        onRaceFinished,
                    );
                }

                fastify.warmupManager.addDriverToWarmup(socket.warmupId);

                const raceState = fastify.warmupManager.warmupState(socket.warmupId);
                if (!raceState) {
                    console.log('Something went wrong');
                    return;
                }

                connectDriver(raceState);

                // All the players are there, let's start
                if (shouldStartRace(raceState)) {
                    await startRace(socket.warmupId);
                }
            }

            const onDisconnect = async (reason: any) => {
                updateDriversCount();

                fastify.warmupManager.disconnectDriverFromWarmup(socket.warmupId);
                disconnectDriver();
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
    const warmupManager = new WarmupManager(trackData);
    const warmupService = new WarmupService(fastify.redis, fastify.locker)
    fastify.decorate('racesService', racesService)
    fastify.decorate('raceManager', raceManager);
    fastify.decorate('warmupService', warmupService)
    fastify.decorate('warmupManager', warmupManager);

    fastify.addHook('onClose', () => {
        const now = Date.now();
        // Clean up all races
        const activeRaces = fastify.raceManager.getActiveRaces();
        for (const raceId of activeRaces) {
            fastify.racesService.finish(raceId, now)
        }

        // Clean up all warmups
        const activeWarmups = fastify.warmupManager.getActiveWarmups();
        for (const warmupId of activeWarmups) {
            fastify.warmupService.finish(warmupId, now)
        }
        fastify.raceManager.shutdown();
        fastify.warmupManager.shutdown();
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
