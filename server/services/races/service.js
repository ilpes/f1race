"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_DRIVER_PER_RACE = void 0;
const lodash_1 = require("lodash");
exports.MAX_DRIVER_PER_RACE = 2;
class RacesService {
    constructor(redis, locker) {
        this.redis = redis;
        this.locker = locker;
    }
    async status(raceId) {
        const status = await this.redis.hget(`races:${raceId}`, 'status');
        if (status === null) {
            throw new Error('Unable to get race status...');
        }
        return status;
    }
    async starting(raceId) {
        await this.redis.hset(`races:${raceId}`, {
            'status': 'starting',
            'started_at': Date.now(),
        });
    }
    async start(raceId) {
        await this.redis.hset(`races:${raceId}`, {
            'status': 'started',
            'started_at': Date.now(),
        });
    }
    async finish(raceId, sessionId) {
        const startedAt = await this.redis.hget(`races:${raceId}`, 'started_at');
        const startTime = startedAt ? parseInt(startedAt) : null;
        if (startTime === null) {
            throw new Error('Something is off here...');
        }
        const now = Date.now();
        const position = await this.position(raceId, sessionId);
        if (position === null) {
            throw new Error('Unable to get position...');
        }
        const driversList = await this.driversList(raceId);
        const otherDriversList = (0, lodash_1.filter)(driversList, (driverData) => driverData.position !== position);
        const finishers = (0, lodash_1.filter)(otherDriversList, (driverData) => driverData.result !== null);
        const driversLeft = (0, lodash_1.filter)(otherDriversList, (driverData) => driverData.result === null && driverData.status === 'connected');
        const driversLeftCount = driversLeft.length;
        const finishersCount = finishers.length;
        const finalPosition = finishersCount + 1;
        await this.redis.hset(`races:${raceId}:drivers:${sessionId}`, {
            'finished_in': now - startTime,
            'position': finalPosition,
        });
        // If this was the last driver OR all the remaining ones are disconnected
        // then finish the race
        const shouldFinish = (finishersCount === (exports.MAX_DRIVER_PER_RACE - 1)) || driversLeftCount === 0;
        if (shouldFinish) {
            await this.redis.hset(`races:${raceId}`, {
                'status': 'finished',
                'finished_at': now,
            });
        }
        return {
            position: position,
            status: 'connected',
            data: null, // No need here to send the data...
            result: {
                position: finalPosition,
                time: now - startTime,
            }
        };
    }
    async create(sessionId) {
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
    async driverData(raceId, sessionId) {
        const toDriverPosition = (data) => {
            if (!data.x) {
                return null;
            }
            return {
                x: parseFloat(data.x),
                y: parseFloat(data.y),
                rotation: parseFloat(data.rotation),
                laps: parseFloat(data.laps),
                distance: parseFloat(data.distance),
            };
        };
        const toDriverResult = (data) => {
            if (!all.finished_in) {
                return null;
            }
            return {
                position: parseInt(all.position),
                time: parseInt(all.finished_in),
            };
        };
        const position = await this.position(raceId, sessionId);
        if (position === null) {
            throw new Error('Unable to get position...');
        }
        const all = await this.redis.hgetall(`races:${raceId}:drivers:${sessionId}`);
        const driverData = {
            position: position,
            status: all.status || 'connected',
            data: toDriverPosition(all),
            result: toDriverResult(all),
        };
        return driverData;
    }
    async driversList(raceId) {
        const drivers = await this.redis.zrange(`races:${raceId}:drivers`, 0, -1);
        const list = [];
        for (const sessionId of drivers) {
            const driverData = await this.driverData(raceId, sessionId);
            list.push(driverData);
        }
        return list;
    }
    async position(raceId, sessionId) {
        const position = await this.redis.zscore(`races:${raceId}:drivers`, sessionId);
        return position === null ? null : parseInt(position);
    }
    async current() {
        return this.redis.get(`race`);
    }
    async isFinished(raceId) {
        try {
            const status = await this.status(raceId);
            return status === 'finished';
        }
        catch (error) {
            return false;
        }
    }
    async hasJoinedAtPosition(raceId, sessionId, position) {
        const driverPosition = await this.position(raceId, sessionId);
        return driverPosition === position;
    }
    async driversCount(raceId) {
        return this.redis.zcard(`races:${raceId}:drivers`);
    }
    async join(raceId, sessionId, position) {
        await this.redis.zadd(`races:${raceId}:drivers`, position, sessionId);
    }
    async connect(raceId, sessionId) {
        await this.redis.hset(`races:${raceId}:drivers:${sessionId}`, { 'status': 'connected' });
    }
    async disconnect(raceId, sessionId) {
        await this.redis.hset(`races:${raceId}:drivers:${sessionId}`, { 'status': 'disconnected' });
    }
    async update(raceId, sessionId, data) {
        await this.redis.hset(`races:${raceId}:drivers:${sessionId}`, {
            x: data.x,
            y: data.y,
            rotation: data.rotation,
            distance: data.distance,
            laps: data.laps,
        });
    }
    async canStart(raceId) {
        const status = await this.status(raceId);
        if (status !== 'starting') {
            return false;
        }
        // Drivers' count is guaranteed here
        const driversList = await this.driversList(raceId);
        for (const driverData of driversList) {
            if (driverData.status === 'disconnected') {
                return false;
            }
        }
        return true;
    }
    async shouldStart(raceId) {
        const status = await this.status(raceId);
        if (status !== 'waiting') {
            return false;
        }
        const driversCount = await this.driversCount(raceId);
        if (driversCount < exports.MAX_DRIVER_PER_RACE) {
            return false;
        }
        const driversList = await this.driversList(raceId);
        for (const driverData of driversList) {
            if (driverData.status === 'disconnected') {
                return false;
            }
        }
        return true;
    }
    async race(sessionId) {
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
            let driversCount = await this.driversCount(lastRaceId);
            if (driversCount < exports.MAX_DRIVER_PER_RACE) {
                const position = driversCount + 1;
                await this.join(lastRaceId, sessionId, position);
                return `${lastRaceId}-${position}`;
            }
            // Create a new race if the current one is full...
            return await this.create(sessionId);
        });
    }
}
exports.default = RacesService;
