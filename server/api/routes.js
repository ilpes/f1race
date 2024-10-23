"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const schema_1 = require("./schema");
const ApiRoutes = async (fastify, options) => {
    fastify.post('/races', { schema: schema_1.raceResponseSchema, onRequest: fastify.csrfProtection }, createRace);
    fastify.get('/csrf-cookie', createToken);
    async function createToken(request, reply) {
        const token = reply.generateCsrf();
        return reply.send({ token });
    }
    async function createRace(request, reply) {
        const raceId = await fastify.racesService.race(request.session.sessionId);
        return reply.send({ raceId });
    }
};
exports.default = ApiRoutes;
