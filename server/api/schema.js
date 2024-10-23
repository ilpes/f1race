"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.raceResponseSchema = void 0;
const raceResponseSchema = {
    response: {
        200: {
            type: 'object',
            properties: {
                raceId: { type: 'string' },
            }
        }
    }
};
exports.raceResponseSchema = raceResponseSchema;
