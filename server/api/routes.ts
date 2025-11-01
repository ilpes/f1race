import {FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest, RouteShorthandOptions} from "fastify";
import {postRaceRequestSchema, raceResponseSchema} from "./schema";

const ApiRoutes = async (fastify: FastifyInstance, options: FastifyPluginOptions) => {

    fastify.post<postRaceRequestSchema>('/races', {schema: raceResponseSchema, onRequest: fastify.csrfProtection} as RouteShorthandOptions, createRace);
    fastify.post<postRaceRequestSchema>('/warmups', {schema: raceResponseSchema, onRequest: fastify.csrfProtection} as RouteShorthandOptions, createWarmup);
    fastify.get('/csrf-cookie', createToken);

    async function createToken (request: FastifyRequest, reply: FastifyReply) {
        const token =  reply.generateCsrf();
        return reply.send({token});
    }

    async function createRace (request: FastifyRequest<postRaceRequestSchema>, reply: FastifyReply) {
        const raceId = await fastify.racesService.race(request.session.sessionId);
        return reply.send({raceId});
    }

    async function createWarmup (request: FastifyRequest<postRaceRequestSchema>, reply: FastifyReply) {
        const raceId = await fastify.warmupService.race(request.session.sessionId);
        return reply.send({raceId});
    }
};

export default ApiRoutes;
