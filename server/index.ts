import fastify, {FastifyInstance} from "fastify";
import app from "./app";

const server: FastifyInstance = fastify({
    logger: true
});

server.register(app, {
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

server.listen({port: 3000, host: '0.0.0.0'}, (error, address) => {
    if (error !== null) {
        console.error(error)
        process.exit(1)
    }

    console.log(`Server listening at ${address}`)
})
