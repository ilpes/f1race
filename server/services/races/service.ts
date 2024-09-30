import Redis from "ioredis";
import Redlock from "redlock";

export const MAX_DRIVER_PER_RACE = 2;

class RacesService {

    private redis: Redis;
    private locker: Redlock;

    constructor(redis: Redis, locker: Redlock) {
        this.redis = redis;
        this.locker = locker;
    }

    async hasStarted(raceId: string): Promise<boolean> {
        const status = await this.redis.hget(`races:${raceId}`, 'status');
        return status === 'started';
    }

    async start(raceId: string): Promise<boolean> {
        await this.redis.hset(`races:${raceId}`, {
            'status': 'started',
        });
    }

    async create(sessionId: string) {
        const position = 1;
        const lastRaceId = crypto.randomUUID();
        await this.redis.set(`race`, lastRaceId);
        await this.redis.zadd(`races:${lastRaceId}:drivers`, position, sessionId);
        await this.redis.expire(`races.${lastRaceId}:drivers`, 86400);
        await this.redis.hset(`races:${lastRaceId}`, {
            'circuit': 'Monza',
            'status': 'waiting',
        });
        await this.redis.expire(`races:${lastRaceId}`, 86400);

        return `${lastRaceId}-${position}`;
    }

    async position(raceId: string, sessionId: string): Promise<number|null> {
        console.log(`Calculating position in race ${raceId} of ${sessionId}: `, await this.redis.zscore(`races:${raceId}:drivers`, sessionId));
        return await this.redis.zscore(`races:${raceId}:drivers`, sessionId);
    }

    async current(): Promise<string | null> {
        return await this.redis.get(`race`);
    }

    async hasJoined(raceId: string, sessionId: string): Promise<boolean> {
       return await this.position(raceId, sessionId) !== null;
    }

    async hasJoinedAtPosition(raceId: string, sessionId: string, position: number): Promise<boolean> {
        return await this.position(raceId, sessionId) === position;
    }

    async driversCount(raceId: string): Promise<number> {
        return await this.redis.zcard(`races:${raceId}:drivers`);
    }

    async join(raceId: string, sessionId: string, position: number): Promise<void> {
        await this.redis.zadd(`races:${raceId}:drivers`, position, sessionId);
    }

    async canStart(raceId): Promise<boolean> {
        const driversCount = await this.driversCount(raceId);

        return driversCount === MAX_DRIVER_PER_RACE;
    }

    async race(sessionId: string) {
        return await this.locker.using(['race-lock'], 1000, async (signal) => {

            // Fetch the last race id...
            const lastRaceId = await this.current();

            // If there is no current race...
            if (lastRaceId === null) {
                return await this.create(sessionId);
            }

            // If position is null, he is not part of the race
            let position = await this.position(lastRaceId, sessionId);
            if (position !== null) {
                // get the position
                return `${lastRaceId}-${position}`;
            }

            // If not, let's add it to the current race
            let driversCount : number = await this.driversCount(lastRaceId);
            if (driversCount < MAX_DRIVER_PER_RACE) {
                const position = driversCount + 1;

                await this.join(lastRaceId, sessionId, position)
                return `${lastRaceId}-${position}`;
            }

            // Create a new race if the current one is full...
            return await this.create(sessionId);
        });
    }
}

export default RacesService;
