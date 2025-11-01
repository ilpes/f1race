import Redis from "ioredis";
import Redlock from "redlock";
import {RaceResult, RaceStatus} from "../types";
import {MAX_DRIVER_PER_RACE} from "../constants";


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

    async startedAt(raceId: string): Promise<number> {
        const startedAt = await this.redis.hget(`races:${raceId}`, 'started_at');
        if (startedAt === null) {
            throw new Error('Unable to get started at...');
        }

        return Number(startedAt);
    }

    async start(raceId: string, startedAt: number): Promise<void> {
        await this.redis.hset(`races:${raceId}`, {
            'status': 'started',
            'started_at': startedAt,
        });
    }

    async finish(raceId: string, finishedAt: number): Promise<RaceResult> {
        await this.redis.hset(`races:${raceId}`, {
            'status': 'finished',
            'finished_at': finishedAt,
        });

        return await this.result(raceId);
    }

    async saveResult(raceId: string, driverNumber: number, time: number) {
        await this.redis.hset(`races:${raceId}:results:${driverNumber}`, {
            'finished_at': time,
        });
    }

    async driverResult(raceId: string, driverNumber: number): Promise<number> {
        const finishedAt = await this.redis.hget(`races:${raceId}:results:${driverNumber}`, 'finished_at');
        if (finishedAt === null) {
            throw new Error('Unable to get finished at...');
        }

        return Number(finishedAt);
    }

    async result(raceId: string): Promise<RaceResult> {
        const startedAt = await this.startedAt(raceId);
        const driversCount = await this.driversCount(raceId);
        let sortedDrivers: Array<[string, number]> = [];

        console.log(raceId, startedAt, driversCount);

        // First pass: collect all driver times
        for (let i = 1; i <= driversCount; i++) {
            const driverFinishedAt = await this.driverResult(raceId, i);
            const time = driverFinishedAt - startedAt;
            sortedDrivers.push([String(i), time]);
        }

        // Sort by time (ascending - lowest time wins)
        sortedDrivers.sort((a, b) => a[1] - b[1]);

        // Get the winning time (fastest time)
        const winningTime = sortedDrivers[0][1];

        // Second pass: build the result with position and distance
        let result: RaceResult = {};
        for (let i = 0; i < sortedDrivers.length; i++) {
            const [driverNumber, time] = sortedDrivers[i];
            result[driverNumber] = {
                time: time,
                distance: i === 0 ? null : time - winningTime,
                position: i + 1
            };
        }

        return result;
    }

    async create(sessionId: string) {
        const driverNumber = 1;
        const lastRaceId = crypto.randomUUID();
        await this.redis.set(`race`, lastRaceId);
        await this.redis.zadd(`races:${lastRaceId}:drivers`, driverNumber, sessionId);
        // await this.redis.expire(`races.${lastRaceId}:drivers`, 86400);
        await this.redis.hset(`races:${lastRaceId}`, {
            'circuit': 'Monza',
            'status': 'waiting',
        });
        // await this.redis.expire(`races:${lastRaceId}`, 86400);

        return `${lastRaceId}-${driverNumber}`;
    }

    async driverNumber(raceId: string, sessionId: string): Promise<number|null> {
        const driverNumber = await this.redis.zscore(`races:${raceId}:drivers`, sessionId);
        return driverNumber === null ? null : parseInt(driverNumber);
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

    async hasJoinedWithNumber(raceId: string, sessionId: string, num: number): Promise<boolean> {
        const driverNumber = await this.driverNumber(raceId, sessionId);
        return driverNumber === num;
    }

    async driversCount(raceId: string): Promise<number> {
        return this.redis.zcard(`races:${raceId}:drivers`);
    }

    async join(raceId: string, sessionId: string, driverNumber: number): Promise<void> {
        await this.redis.zadd(`races:${raceId}:drivers`, driverNumber, sessionId);
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


            // If driverNumber is null, he is not part of the race
            let driverNumber = await this.driverNumber(lastRaceId, sessionId);
            if (driverNumber !== null) {
                // get the driverNumber
                return `${lastRaceId}-${driverNumber}`;
            }

            // If not, let's add it to the current race
            let driversCount : number = await this.driversCount(lastRaceId);
            if (driversCount < MAX_DRIVER_PER_RACE) {
                const driverNumber = driversCount + 1;

                await this.join(lastRaceId, sessionId, driverNumber)
                return `${lastRaceId}-${driverNumber}`;
            }

            // Create a new race if the current one is full...
            return await this.create(sessionId);
        });
    }
}

export default RacesService;
