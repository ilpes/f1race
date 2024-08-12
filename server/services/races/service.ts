import Redis from "ioredis";
import Redlock from "redlock";

const MAX_DRIVER_PER_RACE = 2;

class RacesService {

    private redis: Redis;
    private locker: Redlock;

    constructor(redis: Redis, locker: Redlock) {
        this.redis = redis;
        this.locker = locker;
    }

    async create(sessionId: string) {
        const lastRaceId = crypto.randomUUID();
        await this.redis.set(`race`, lastRaceId);
        await this.redis.sadd(`races:${lastRaceId}:drivers`, sessionId);
        await this.redis.expire(`races.${lastRaceId}:drivers`, 86400);
        await this.redis.hset(`races:${lastRaceId}`, {
            'circuit': 'Monza',
        });
        await this.redis.expire(`races:${lastRaceId}`, 86400);

        return lastRaceId;
    }

    async current(): Promise<string | null> {
        return await this.redis.get(`race`);
    }

    async hasJoined(raceId: string, sessionId: string): Promise<boolean> {
        let isDriver : number = await this.redis.sismember(`races:${raceId}:drivers`, sessionId);
        return isDriver === 1;
    }

    async driversCount(raceId: string): Promise<number> {
        return await this.redis.scard(`races:${raceId}:drivers`);
    }

    async join(raceId: string, sessionId: string): Promise<void> {
        await this.redis.sadd(`races:${raceId}:drivers`, sessionId);
    }

    async race(sessionId: string) {
        return await this.locker.using(['race-lock'], 1000, async (signal) => {

            // Fetch the last race id...
            const lastRaceId = await this.current();

            // If there is no current race...
            if (lastRaceId === null) {
                return await this.create(sessionId);
            }

            // Check if the user is already a driver of the current race...
            let hasJoined : boolean = await this.hasJoined(lastRaceId, sessionId)
            if (hasJoined) {
                return lastRaceId;
            }

            // If not, let's add it to the current race
            let lastRacePlayers : number = await this.driversCount(lastRaceId);
            if (lastRacePlayers < MAX_DRIVER_PER_RACE) {
                await this.join(lastRaceId, sessionId)
                return lastRaceId;
            }

            // Create a new race if the current one is full...
            return await this.create(sessionId);
        });
    }
}

export default RacesService;
