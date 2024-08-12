import {FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest} from "fastify";
import {postRaceRequestSchema, raceResponseSchema} from "./schema";

const ApiRoutes = async (fastify: FastifyInstance, options: FastifyPluginOptions) => {

    fastify.post<postRaceRequestSchema>('/races', {schema: raceResponseSchema}, createRace);

    async function createRace (request: FastifyRequest<postRaceRequestSchema>, reply: FastifyReply) {
        const raceId = await fastify.racesService.race(request.session.sessionId);
        return reply.send({
            url: raceId,
            session: request.session.sessionId,
        })
    }
};

export default ApiRoutes;
