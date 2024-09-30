import {
    FastifyInstance,
    FastifyPluginOptions, FastifyRequest
} from "fastify";
import {Server, ServerOptions} from "socket.io";
import Redis from "ioredis";
import fp from 'fastify-plugin'
import ApiRoutes from "./api/routes";
import Redlock from "redlock";
import RacesService, {MAX_DRIVER_PER_RACE} from "./services/races/service";
import {fastifyCookie} from "@fastify/cookie";
import {fastifySession} from "@fastify/session";
import {fastifyStatic} from "@fastify/static";
import path from "node:path";
import WebRoutes from "./web/routes";
import {fastifyCsrfProtection} from "@fastify/csrf-protection";

declare module 'fastify' {
    export interface FastifyInstance {
        io: Server,
        redis: Redis,
        locker: Redlock,
        racesService: RacesService,
    }

    interface Session {
        foo?: string
    }
}

const io = fp(async (fastify: FastifyInstance, options: FastifyPluginOptions) => {

    const sessionFor = (socket): string => {
        const cookies = fastify.parseCookie(socket.handshake.headers.cookie);
        const encryptedSessionId = cookies.sessionId;
        const request = {session: null};
        let sessionId: string = '';
        fastify.decryptSession(encryptedSessionId, request as FastifyRequest, () => {
            sessionId = request.session.sessionId;
        });

        return sessionId;
    }

    const connect = () => {
        fastify.io.on("connection", (socket: any) => {

            socket.on("joined", async (data: {raceId: string, position: string}, callback: Function) => {

                const sessionId = sessionFor(socket);
                const hasJoined = await fastify.racesService.hasJoinedAtPosition(data.raceId, sessionId, data.position as number);

                // It should not happen but still...
                if (!hasJoined) {
                    socket.disconnect();
                    return;
                }

                // If socket is already in the room
                if (socket.rooms.has(data.raceId)) {
                    return;
                }

                callback({foo: 'bar'});

                // Join the room
                socket.join(data.raceId);

                // Notify other in the room about the new driver
                socket.broadcast.to(data.raceId).emit("joined", {position: data.position});



                const drivers = await fastify.io.in(data.raceId).fetchSockets();
                const driversCount = drivers.length;

                if (driversCount < MAX_DRIVER_PER_RACE) {
                    return;
                }

                const hasStarted = await fastify.racesService.hasStarted(data.raceId)
                if (hasStarted) {
                    return;
                }

                await fastify.racesService.start(data.raceId);
                fastify.io.in(data.raceId).emit("start");
            });

            socket.on("disconnect", (reason: any) => {
                console.log("Socket disconnected", socket.id)
            });
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
