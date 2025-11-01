export type DriverPosition = {
    x: number,
    y: number,
    rotation: number,
    distance: number,
    laps: number,
};

export type DriverStatus = 'connected' | 'disconnected';

export type DriverData = {
    position: number,
    status: DriverStatus,
};

export interface RaceState {
    state: GameState;
    status: RaceStatus;
    result: RaceResult | null;
    driverCount: number;
    startedAt: number | null;
    finishedAt: number | null;
    laps: number;
}

export interface SerializedDriverState {
    x: number,
    y: number,
    rotation: number,
    distance: number,
    laps: number,
    velocity: number,
    isSpeedingUp: boolean,
    onTrack: boolean,
    finished: boolean
}

export interface GameState {
    drivers: { [driverNumber: string]: SerializedDriverState };
    serverTime: number;
    tickNumber: number;
}

export interface RaceResult {
    [driverNumber: string]: Result
}

export interface Result {
    time: number;
    distance: number | null;
    position: number;
}

export interface ReadableResult {
    time: string;
    distance: string | null;
    position: number;
}

export type RaceStatus = 'waiting' | 'starting' | 'start' | 'started' | 'finished';
export type DriverType = 'auto' | 'manual';
