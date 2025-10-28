/**
 * Race Manager
 * Manages multiple concurrent races, each with their own game loop
 */

import {GameEngine, GameState, PlayerInput} from './GameEngine';
import {TrackData} from "./physics";
import {Race} from "./Race";

export const MAX_DRIVER_PER_RACE = 2;
export const LAPS_PER_RACE = 2;

export interface RaceConfig {
    raceId: string;
    trackData: TrackData;
    maxDrivers: number;
}

export interface RaceState {
    state: GameState;
    status: RaceStatus;
    driverCount: number;
}

export type DriverStatus = 'connected' | 'disconnected';
export type RaceStatus = 'waiting' | 'starting' | 'started' | 'finished';

export class RaceManager {


    private races: Map<string, Race> = new Map();
    private readonly trackData: TrackData;

    constructor(trackData: TrackData) {
        this.trackData = trackData;
        console.log(`RaceManager initialized with track: ${trackData.name}`);
    }

    // Create a new race
    createRace(
        raceId: string,
        maxDrivers: number,
        onStateUpdate: (raceId: string, state: GameState) => void,
        onFinished: (raceId: string, time: number) => void,
    ): Race {
        if (this.races.has(raceId)) {
            return this.races.get(raceId)!;
        }

        const race = new Race(
            {raceId: raceId, trackData: this.trackData, maxDrivers: maxDrivers},
            (state) => {
                onStateUpdate(raceId, state);
            },
            (driverNumber: number, time: number) => {
                console.log(`Driver ${driverNumber} finished at ${time}`);
            },
            (time: number) => {
                onFinished(raceId, time);
            }
        );

        this.races.set(raceId, race);
        console.log(`Created race ${raceId}`);

        return race;
    }

    // Get a race by ID
    getRace(raceId: string): Race | undefined {
        return this.races.get(raceId);
    }

    // Add driver to a race
    addDriverToRace(raceId: string, driverNumber: number): boolean {
        const race = this.races.get(raceId);
        if (!race) {
            console.error(`Race ${raceId} not found`);
            return false;
        }

        if (race.hasDriver(driverNumber)) {
            console.log(`Driver ${driverNumber} already in race ${raceId}, reconnecting...`);
            race.connectDriver(driverNumber)
            return true;
        }

        if (race.isFull()) {
            console.error(`Race ${raceId} is full...`);
            return false;
        }

        race.addDriver(driverNumber);
        return true;
    }

    disconnectDriverFromRace(raceId: any, driverNumber: any) {
        const race = this.races.get(raceId);
        if (!race) {
            console.error(`Race ${raceId} not found`);
            return null;
        }
        if (!race.hasDriver(driverNumber)) {
            console.error(`Race ${driverNumber} not found`);
            return null;
        }
        race.disconnectDriver(driverNumber);
    }

    raceState(raceId: string): RaceState | null {
        const race = this.races.get(raceId);
        if (!race) {
            console.error(`Race ${raceId} not found`);
            return null;
        }
        return {
            state: race.gameEngine.serializeGameState(),
            status: race.getStatus(),
            driverCount: race.getDriverCount(),
        };
    }

    getStartedAt(raceId: string): number | null {
        const race = this.races.get(raceId);
        if (!race) {
            console.error(`Race ${raceId} not found`);
            return null;
        }
        return race.getStartedAt();
    }

    // Queue input for a specific race
    queueInput(raceId: string, input: PlayerInput): void {
        const race = this.races.get(raceId);
        if (race) {
            race.queueInput(input);
        }
    }

    // Start a specific race
    startRace(raceId: string): void {
        const race = this.races.get(raceId);
        if (race) {
            race.start();
        }
    }

    starting(raceId: string) {
        const race = this.races.get(raceId);
        if (race) {
            race.starting();
        }
    }

    // Stop a specific race
    stopRace(raceId: string): void {
        const race = this.races.get(raceId);
        if (race) {
            race.stop();
        }
    }

    // Remove a race (cleanup)
    removeRace(raceId: string): void {
        const race = this.races.get(raceId);
        if (race) {
            race.stop();
            this.races.delete(raceId);
            console.log(`Removed race ${raceId}`);
        }
    }

    // Get all active races
    getActiveRaces(): string[] {
        return Array.from(this.races.keys());
    }

    // Cleanup all races
    shutdown(): void {
        console.log('Shutting down all races...');
        this.races.forEach(race => race.stop());
        this.races.clear();
    }
}
