import Redis from "ioredis";
import Redlock from "redlock";
import {RaceResult, RaceStatus} from "../types";


class WarmupService {

    private redis: Redis;
    private locker: Redlock;

    constructor(redis: Redis, locker: Redlock) {
        this.redis = redis;
        this.locker = locker;
    }

    async status(warmupId: string): Promise<RaceStatus> {
        const status = await this.redis.hget(`warmup:${warmupId}`, 'status');
        if (status === null) {
            throw new Error('Unable to get race status...');
        }

        return status as RaceStatus;
    }

    async start(warmupId: string, startedAt: number): Promise<void> {
        await this.redis.hset(`warmup:${warmupId}`, {
            'status': 'started',
            'started_at': startedAt,
        });
    }

    async finish(warmupId: string, finishedAt: number): Promise<RaceResult> {
        await this.redis.hset(`warmup:${warmupId}`, {
            'status': 'finished',
            'finished_at': finishedAt,
        });

        return await this.result(warmupId);
    }

    async startedAt(warmupId: string): Promise<number> {
        const startedAt = await this.redis.hget(`warmup:${warmupId}`, 'started_at');
        if (startedAt === null) {
            throw new Error('Unable to get started at...');
        }

        return Number(startedAt);
    }

    async finishedAt(warmupId: string): Promise<number> {
        const finishedAt = await this.redis.hget(`warmup:${warmupId}`, 'finished_at');
        if (finishedAt === null) {
            throw new Error('Unable to get finished at...');
        }

        return Number(finishedAt);
    }

    async result(warmupId: string): Promise<RaceResult> {
        const startedAt = await this.startedAt(warmupId);
        const finishedAt = await this.finishedAt(warmupId);
        return {'1': {position: 1, time: finishedAt - startedAt, distance: null}};
    }

    async create(sessionId: string) {
        const lastWarmupId = crypto.randomUUID();
        await this.redis.set(`warmup`, lastWarmupId);
       // await this.redis.zadd(`warmup:${lastRaceId}:drivers`, position, sessionId);
        // await this.redis.expire(`races.${lastRaceId}:drivers`, 86400);
        await this.redis.hset(`warmup:${lastWarmupId}`, {
            'circuit': 'Monza',
            'status': 'waiting',
            'session_id': sessionId,
        });
        // await this.redis.expire(`races:${lastRaceId}`, 86400);

        return `${lastWarmupId}`;
    }

    async current(): Promise<string | null> {
        return this.redis.get(`warmup`);
    }

    async isFinished(warmupId: string): Promise<boolean> {
        try {
            const status: RaceStatus = await this.status(warmupId);
            return status === 'finished';
        } catch (error: unknown) {
            return false;
        }
    }

    async hasJoined(warmupId: string, sessionId: string): Promise<boolean> {
        const warmupSession = await this.redis.hget(`warmup:${warmupId}`, 'session_id');
        return warmupSession === sessionId;
    }

    async race(sessionId: string) {
        return await this.locker.using(['race-lock'], 1000, async (signal) => {

            // Fetch the last race id...
            const lastWarmupId = await this.current();

            // If there is no current race...
            if (lastWarmupId === null) {
                return await this.create(sessionId);
            }

            let isFinished = await this.isFinished(lastWarmupId);
            if (isFinished) {
                return await this.create(sessionId);
            }

            // If he is part of the race and the race is not finished he should return there
            let hasJoined = await this.hasJoined(lastWarmupId, sessionId);
            if (hasJoined) {
                return lastWarmupId;
            }

            // Create a new race if the current one is full...
            return await this.create(sessionId);
        });
    }
}

export default WarmupService;
