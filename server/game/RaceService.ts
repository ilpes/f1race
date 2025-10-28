import Redis from "ioredis";
import Redlock from "redlock";
import {MAX_DRIVER_PER_RACE, RaceManager, RaceStatus} from "./RaceManager";


class RacesService {

    private redis: Redis;
    private locker: Redlock; 

    constructor(redis: Redis, locker: Redlock) {
        this.redis = redis;
        this.locker = locker;
    }

    async status(raceId: string): Promise<RaceStatus> {
        const status = await this.redis.hget(`races:${raceId}`, 'status');
        if (status === null) {
            throw new Error('Unable to get race status...');
        }

        return status as RaceStatus;
    }

    async start(raceId: string, startedAt: number): Promise<void> {
        await this.redis.hset(`races:${raceId}`, {
            'status': 'started',
            'started_at': startedAt,
        });
    }

    async finish(raceId: string, finishedAt: number): Promise<void> {
        await this.redis.hset(`races:${raceId}`, {
            'status': 'finished',
            'finished_at': finishedAt,
        });
    }

    // async finish(raceId: string, sessionId: string): Promise<DriverData> {
    //
    //     const startedAt = await this.redis.hget(`races:${raceId}`, 'started_at');
    //     const startTime: number | null = startedAt ? parseInt(startedAt) : null;
    //
    //     if (startTime === null) {
    //         throw new Error('Something is off here...');
    //     }
    //
    //     const now = Date.now();
    //
    //     const position = await this.position(raceId, sessionId);
    //     if (position === null) {
    //         throw new Error('Unable to get position...');
    //     }
    //
    //     const driversList = await this.driversList(raceId);
    //     const otherDriversList = filter(driversList, (driverData: DriverData) => driverData.position !== position);
    //
    //     const finishers = filter(otherDriversList, (driverData: DriverData) => driverData.result !== null);
    //     const driversLeft = filter(otherDriversList, (driverData: DriverData) => driverData.result === null && driverData.status === 'connected');
    //
    //     const driversLeftCount: number = driversLeft.length;
    //     const finishersCount = finishers.length;
    //     const finalPosition = finishersCount + 1;
    //
    //     await this.redis.hset(`races:${raceId}:drivers:${sessionId}`, {
    //         'finished_in': now - startTime,
    //         'position': finalPosition,
    //     });
    //
    //     // If this was the last driver OR all the remaining ones are disconnected
    //     // then finish the race
    //     const shouldFinish = (finishersCount === (MAX_DRIVER_PER_RACE - 1)) || driversLeftCount === 0;
    //
    //     if (shouldFinish) {
    //         await this.redis.hset(`races:${raceId}`, {
    //             'status': 'finished',
    //             'finished_at': now,
    //         });
    //     }
    //
    //     return {
    //         position: position,
    //         status: 'connected' as DriverStatus,
    //         data: null, // No need here to send the data...
    //         result: {
    //             position: finalPosition,
    //             time: now - startTime,
    //         }
    //     };
    // }

    async create(sessionId: string) {
        const position = 1;
        const lastRaceId = crypto.randomUUID();
        await this.redis.set(`race`, lastRaceId);
        await this.redis.zadd(`races:${lastRaceId}:drivers`, position, sessionId);
        // await this.redis.expire(`races.${lastRaceId}:drivers`, 86400);
        await this.redis.hset(`races:${lastRaceId}`, {
            'circuit': 'Monza',
            'status': 'waiting',
        });
        // await this.redis.expire(`races:${lastRaceId}`, 86400);

        return `${lastRaceId}-${position}`;
    }

    async position(raceId: string, sessionId: string): Promise<number|null> {
        const position = await this.redis.zscore(`races:${raceId}:drivers`, sessionId);
        return position === null ? null : parseInt(position);
    }

    async current(): Promise<string | null> {
        return this.redis.get(`race`);
    }

    async isFinished(raceId: string): Promise<boolean> {
        try {
            const status: RaceStatus = await this.status(raceId);
            return status === 'finished';
        } catch (error: unknown) {
            return false;
        }
    }

    async hasJoinedAtPosition(raceId: string, sessionId: string, position: number): Promise<boolean> {
        const driverPosition = await this.position(raceId, sessionId);
        return driverPosition === position;
    }

    async driversCount(raceId: string): Promise<number> {
        return this.redis.zcard(`races:${raceId}:drivers`);
    }

    async join(raceId: string, sessionId: string, position: number): Promise<void> {
        await this.redis.zadd(`races:${raceId}:drivers`, position, sessionId);
    }

    async race(sessionId: string) {
        return await this.locker.using(['race-lock'], 1000, async (signal) => {

            // Fetch the last race id...
            const lastRaceId = await this.current();

            // If there is no current race...
            if (lastRaceId === null) {
                return await this.create(sessionId);
            }

            let isFinished = await this.isFinished(lastRaceId);
            if (isFinished) {
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
