import fastify, {FastifyInstance} from "fastify";
import app from "./app";

const server: FastifyInstance = fastify({
    logger: true
});

server.register(app, {
    io: {
    },
    redis: {
        host: process.env.REDIS_HOST || '127.0.0.1',
    },
    session: {
        secret: process.env.SESSION_SECRET || 'lorem-ipsum-dolor-sit-amet-lorem-ipsum-dolor-sit-amet',
        cookie: {
            secure: 'auto'
        }
    },
    cookies: {
        secure: 'auto',
        secret: process.env.COOKIE_SECRET || 'lorem-ipsum-dolor-sit-amet-lorem-ipsum-dolor-sit-amet',
    },
});

const port = process.env.PORT || '3000';
const host = process.env.HOST || '127.0.0.1';

server.listen({port: parseInt(port), host: host}, (error, address) => {
    if (error !== null) {
        console.error(error)
        process.exit(1)
    }

    console.log(`Server listening at ${address}`)
})
