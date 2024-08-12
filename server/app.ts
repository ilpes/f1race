import {
    FastifyInstance,
    FastifyPluginOptions, FastifyReply, FastifyRequest
} from "fastify";
import {Server, ServerOptions} from "socket.io";
import Redis from "ioredis";
import fp from 'fastify-plugin'
import ApiRoutes from "./api/routes";
import Redlock from "redlock";
import RacesService from "./services/races/service";
import {fastifyCookie} from "@fastify/cookie";
import {fastifySession} from "@fastify/session";
import {fastifyStatic} from "@fastify/static";
import * as path from "node:path";
import WebRoutes from "./web/routes";

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

    const connect = () => {
        fastify.io.on("connection", (socket: any) => {
            console.info("Socket connected", socket.id);

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
    fastify.register(fastifyCookie);
    fastify.register(fastifySession, options.session);
    fastify.register(ApiRoutes, {prefix: '/api'});
    fastify.register(WebRoutes);
};

export default app;
