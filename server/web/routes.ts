import {FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest} from "fastify";

interface IQueryParameters {
    raceIdAndPosition: string;
}

const WebRoutes = async (fastify: FastifyInstance, options: FastifyPluginOptions) => {
    fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
          return reply.sendFile('index.html');
    });

    fastify.get('/races/:raceIdAndPosition', async (request: FastifyRequest, reply: FastifyReply) => {
        const {raceIdAndPosition} = request.params as IQueryParameters;
        const lastIndex = raceIdAndPosition.lastIndexOf('-');

        const raceId = raceIdAndPosition.slice(0, lastIndex);
        const position = raceIdAndPosition.slice(lastIndex + 1);

        const sessionId = request.session.sessionId;
        const hasJoined = await fastify.racesService.hasJoinedAtPosition(raceId, sessionId, position as number);

        if (!hasJoined) {
            return reply.code(403).send('Unauthorized.');
        }

        return reply.sendFile('race.html');
    });
};

export default WebRoutes;
