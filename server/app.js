"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const socket_io_1 = require("socket.io");
const ioredis_1 = __importDefault(require("ioredis"));
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const node_path_1 = __importDefault(require("node:path"));
const redlock_1 = __importDefault(require("redlock"));
const cookie_1 = require("@fastify/cookie");
const session_1 = require("@fastify/session");
const static_1 = require("@fastify/static");
const csrf_protection_1 = require("@fastify/csrf-protection");
const service_1 = __importDefault(require("./services/races/service"));
const routes_1 = __importDefault(require("./api/routes"));
const routes_2 = __importDefault(require("./web/routes"));
const io = (0, fastify_plugin_1.default)(async (fastify, options) => {
    const connect = () => {
        const racesNamespace = fastify.io.of('/races');
        const visitorsNamespace = fastify.io.of('/visitors');
        const updateDriversCount = () => {
            visitorsNamespace.emit('driver-count-update', racesNamespace.sockets.size);
        };
        visitorsNamespace.on('connection', (socket) => {
            updateDriversCount();
        });
        racesNamespace.use(async (socket, next) => {
            if (!socket.handshake.headers.cookie) {
                next(new Error('Cannot enter this race'));
                return;
            }
            const cookies = fastify.parseCookie(socket.handshake.headers.cookie);
            const encryptedSessionId = cookies.sessionId;
            const request = { session: null };
            let sessionId = '';
            fastify.decryptSession(encryptedSessionId, request, () => {
                sessionId = request.session.sessionId;
            });
            const { raceId, position } = socket.handshake.auth;
            const hasJoined = await fastify.racesService.hasJoinedAtPosition(raceId, sessionId, position);
            if (!hasJoined) {
                next(new Error('Cannot enter this race'));
                return;
            }
            socket.sessionId = sessionId;
            socket.raceId = raceId;
            socket.position = position;
            next();
        });
        racesNamespace.on("connection", async (socket) => {
            const onDriverDisconnected = async (reason) => {
                updateDriversCount();
                // Update the driver's status...
                await fastify.racesService.disconnect(socket.raceId, socket.sessionId);
                // Notify the room about the disconnection...
                socket
                    .broadcast
                    .to(socket.raceId)
                    .emit("driver-disconnected", { position: socket.position });
            };
            const onFinish = async () => {
                // @todo: eventually notify other clients...
                const result = await fastify.racesService.finish(socket.raceId, socket.sessionId);
                socket.emit('finished', result);
            };
            const onDriverUpdate = async (data) => {
                socket
                    .broadcast
                    .to(socket.raceId)
                    .emit("driver-update", {
                    position: socket.position,
                    data: data,
                });
                await fastify.racesService.update(socket.raceId, socket.sessionId, data);
            };
            const onDriverConnected = async () => {
                const shouldStart = await fastify.racesService.shouldStart(socket.raceId);
                if (!shouldStart) {
                    return;
                }
                // Starting...
                await fastify.racesService.starting(socket.raceId);
                racesNamespace.in(socket.raceId).emit('starting');
                // And then start...
                setTimeout(async () => {
                    const canStart = await fastify.racesService.canStart(socket.raceId);
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
                const status = await fastify.racesService.status(socket.raceId);
                socket.emit('initialize', drivers, status);
                // Upon update and disconnection
                socket.on('update', onDriverUpdate);
                socket.on('finish', onFinish);
                socket.on("disconnect", onDriverDisconnected);
            };
            const connectDriver = async () => {
                updateDriversCount();
                const driverData = await fastify.racesService.driverData(socket.raceId, socket.sessionId);
                socket
                    .broadcast
                    .to(socket.raceId)
                    .emit("driver-connected", driverData, onDriverConnected);
            };
            await initialize();
            await connectDriver();
        });
    };
    fastify.decorate('io', new socket_io_1.Server(fastify.server, options));
    fastify.addHook('onReady', connect);
});
const redis = (0, fastify_plugin_1.default)(async (fastify, options) => {
    const redis = new ioredis_1.default(options);
    fastify.decorate('redis', redis);
    fastify.decorate('locker', new redlock_1.default([redis]));
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
const decorators = (0, fastify_plugin_1.default)(async (fastify, options) => {
    const racesService = new service_1.default(fastify.redis, fastify.locker);
    fastify.decorate('racesService', racesService);
});
const app = async (fastify, options) => {
    fastify.register(io, options.io);
    fastify.register(redis, options.redis);
    fastify.register(decorators);
    fastify.register(static_1.fastifyStatic, {
        root: node_path_1.default.join(__dirname, '../client/dist')
    });
    fastify.register(cookie_1.fastifyCookie, options.cookies);
    fastify.register(session_1.fastifySession, options.session);
    fastify.register(csrf_protection_1.fastifyCsrfProtection);
    fastify.register(routes_1.default, { prefix: '/api' });
    fastify.register(routes_2.default);
};
exports.default = app;
