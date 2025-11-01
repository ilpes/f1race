import {FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest} from "fastify";

interface IQueryParameters {
    raceIdAndPosition: string;
    warmupId: string;
}

const WebRoutes = async (fastify: FastifyInstance, options: FastifyPluginOptions) => {
    fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
          return reply.sendFile('home.html');
    });

    fastify.get('/races/:raceIdAndPosition', async (request: FastifyRequest, reply: FastifyReply) => {
        const {raceIdAndPosition} = request.params as IQueryParameters;
        const lastIndex = raceIdAndPosition.lastIndexOf('-');

        const raceId = raceIdAndPosition.slice(0, lastIndex);
        const position = parseInt(raceIdAndPosition.slice(lastIndex + 1));

        const sessionId = request.session.sessionId;
        const hasJoined = await fastify.racesService.hasJoinedWithNumber(raceId, sessionId, position);

        if (!hasJoined) {
            return reply.code(403).send('Unauthorized.');
        }

        const isFinished = await fastify.racesService.isFinished(raceId);
        if (isFinished) {
            return reply.redirect('/');
        }

        return reply.sendFile('race.html');
    });

    fastify.get('/warmups/:warmupId', async (request: FastifyRequest, reply: FastifyReply) => {
        const {warmupId} = request.params as IQueryParameters;

        const sessionId = request.session.sessionId;
        const hasJoined = await fastify.warmupService.hasJoined(warmupId, sessionId);

        if (!hasJoined) {
            return reply.code(403).send('Unauthorized.');
        }

        const isFinished = await fastify.warmupService.isFinished(warmupId);
        if (isFinished) {
            return reply.redirect('/');
        }

        return reply.sendFile('warmup.html');
    });
};

export default WebRoutes;
