type postRaceRequestSchema = {
}

const raceResponseSchema = {
    response: {
        200: {
            type: 'object',
            properties: {
                url: { type: 'string' },
                session: {type: 'string'},
            }
        }
    }
}


export {
    postRaceRequestSchema,
    raceResponseSchema,
}
