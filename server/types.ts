import {Path, Point, TrackData} from "./game/physics";

export interface RaceConfig {
    raceId: string;
    trackData: TrackData;
    maxDrivers: number;
    type: 'warmup' | 'race';
}

export interface RaceState {
    state: GameState;
    status: RaceStatus;
    result: RaceResult | null;
    driverCount: number;
    startedAt: number | null;
    finishedAt: number | null;
    laps: number;
}

export interface RaceResult {
    [driverNumber: string]: {
        time: number;
        distance: number | null;
        position: number;
    }
}

export type DriverStatus = 'connected' | 'disconnected';
export type RaceStatus = 'waiting' | 'starting' | 'started' | 'finished';

export interface Position {
    point: Point;
    speed: Point;
    angle: number;
    distance: number;
}

export interface DriverState {
    position: Position;
    laps: number;
    isSpeedingUp: boolean;
    onTrack: boolean;
    crashPosition: Position | null;
    crashPath: Path | null;
    crashRotation: number;
    finished: boolean;
    connected: boolean;
}

export interface PlayerInput {
    driverNumber: number;
    action: 'speed-up' | 'brake';
    sequence: number;
    timestamp: number;
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
