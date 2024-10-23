"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const WebRoutes = async (fastify, options) => {
    fastify.get('/', async (request, reply) => {
        return reply.sendFile('home.html');
    });
    fastify.get('/races/:raceIdAndPosition', async (request, reply) => {
        const { raceIdAndPosition } = request.params;
        const lastIndex = raceIdAndPosition.lastIndexOf('-');
        const raceId = raceIdAndPosition.slice(0, lastIndex);
        const position = parseInt(raceIdAndPosition.slice(lastIndex + 1));
        const sessionId = request.session.sessionId;
        const hasJoined = await fastify.racesService.hasJoinedAtPosition(raceId, sessionId, position);
        if (!hasJoined) {
            return reply.code(403).send('Unauthorized.');
        }
        return reply.sendFile('race.html');
    });
};
exports.default = WebRoutes;
