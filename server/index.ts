import fastify, {FastifyInstance} from "fastify";
import app from "./app";

const server: FastifyInstance = fastify({
    logger: true
});

console.log(process.env);

server.register(app, {
    io: {
    },
    redis: {
        host: process.env.REDIS_HOST || '127.0.0.1',
    },
    session: {
        secret: process.env.SESSION_SECRET,
        cookie: {
            secure: 'auto'
        }
    },
    cookies: {
        secure: 'auto',
        secret: process.env.COOKIE_SECRET,
    },
});

const port = process.env.PORT || 3000;
const host = process.env.HOST || '127.0.0.1';

server.listen({port: port, host: host}, (error, address) => {
    if (error !== null) {
        console.error(error)
        process.exit(1)
    }

    console.log(`Server listening at ${address}`)
})
