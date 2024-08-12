import {FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest} from "fastify";

const WebRoutes = async (fastify: FastifyInstance, options: FastifyPluginOptions) => {
    fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
        return reply.sendFile('index.html');
    });

    fastify.get('/race', async (request: FastifyRequest, reply: FastifyReply) => {
        return reply.sendFile('race.html');
    });
};

export default WebRoutes;
