"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const app_1 = __importDefault(require("./app"));
const server = (0, fastify_1.default)({
    logger: true
});
server.register(app_1.default, {
    io: {
        cors: {
            origin: "http://localhost:5173",
            methods: ["GET", "POST"],
        }
    },
    redis: {
        host: 'redis',
    },
    session: {
        secret: 'foofoofoofoofoofoofoofoofoofoofoo',
        cookie: {
            secure: 'auto'
        }
    },
    cookies: {
        secure: 'auto',
        secret: 'foobar'
    },
});
server.listen({ port: 3000, host: '0.0.0.0' }, (error, address) => {
    if (error !== null) {
        console.error(error);
        process.exit(1);
    }
    console.log(`Server listening at ${address}`);
});
