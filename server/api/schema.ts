type postRaceRequestSchema = {
}

const raceResponseSchema = {
    response: {
        200: {
            type: 'object',
            properties: {
                raceId: { type: 'string' },
            }
        }
    }
}


export {
    postRaceRequestSchema,
    raceResponseSchema,
}
