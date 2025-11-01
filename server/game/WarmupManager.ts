/**
 * Race Manager
 * Manages multiple concurrent races, each with their own game loop
 */

import {TrackData} from "./physics";
import {Race} from "./Race";
import {GameState, PlayerInput, RaceState} from "../types";
import {LAPS_PER_RACE} from "../constants";

export class WarmupManager {


    private warmups: Map<string, Race> = new Map();
    private readonly trackData: TrackData;

    constructor(trackData: TrackData) {
        this.trackData = trackData;
    }

    // Create a new race
    createWarmup(
        warmupId: string,
        onStateUpdate: (raceId: string, state: GameState) => void,
        onFinished: (raceId: string, time: number) => void,
    ): Race {
        if (this.warmups.has(warmupId)) {
            return this.warmups.get(warmupId)!;
        }

        const race = new Race(
            {raceId: warmupId, trackData: this.trackData, maxDrivers: 1, type: 'warmup' },
            (state) => {
                onStateUpdate(warmupId, state);
            },
            (driverNumber: number, time: number) => {
                console.log(`Driver ${driverNumber} finished at ${time}`);
            },
            (time: number) => {
                onFinished(warmupId, time);
            }
        );

        this.warmups.set(warmupId, race);
        console.log(`Created warmup ${warmupId}`);

        return race;
    }

    // Get a warmup by ID
    getWarmup(warmupId: string): Race | undefined {
        return this.warmups.get(warmupId);
    }

    // Add driver to a race
    addDriverToWarmup(warmupId: string): boolean {
        const driverNumber = 1;
        const warmup = this.warmups.get(warmupId);
        if (!warmup) {
            console.error(`Warmup ${warmupId} not found`);
            return false;
        }

        if (warmup.hasDriver(1)) {
            console.log(`Driver already in warmup ${warmupId}, reconnecting...`);
            warmup.connectDriver(driverNumber)
            return true;
        }

        if (warmup.isFull()) {
            console.error(`Warmup ${warmup} is full...`);
            return false;
        }

        warmup.addDriver(driverNumber);
        return true;
    }

    disconnectDriverFromWarmup(warmupId: any) {
        const driverNumber = 1;
        const race = this.warmups.get(warmupId);
        if (!race) {
            console.error(`Warmup ${warmupId} not found`);
            return null;
        }
        if (!race.hasDriver(driverNumber)) {
            console.error(`Race ${driverNumber} not found`);
            return null;
        }
        race.disconnectDriver(driverNumber);
    }

    warmupState(warmupId: string): RaceState | null {
        const warmup = this.warmups.get(warmupId);
        if (!warmup) {
            console.error(`Warmup ${warmupId} not found`);
            return null;
        }
        return {
            state: warmup.gameEngine.serializeGameState(),
            status: warmup.getStatus(),
            driverCount: warmup.getDriverCount(),
            startedAt: warmup.getStartedAt(),
            finishedAt: warmup.getFinishedAt(),
            laps: LAPS_PER_RACE,
            result: warmup.getResult(),
        };
    }

    getStartedAt(warmupId: string): number | null {
        const warmup = this.warmups.get(warmupId);
        if (!warmup) {
            console.error(`Warmup ${warmupId} not found`);
            return null;
        }
        return warmup.getStartedAt();
    }

    // Queue input for a specific race
    queueInput(warmupId: string, input: PlayerInput): void {
        const warmup = this.warmups.get(warmupId);
        if (warmup) {
            warmup.queueInput(input);
        }
    }

    // Start a specific race
    startWarmup(warmupId: string): void {
        const warmup = this.warmups.get(warmupId);
        if (warmup) {
            warmup.start();
        }
    }

    starting(warmupId: string) {
        const warmup = this.warmups.get(warmupId);
        if (warmup) {
            warmup.starting();
        }
    }

    // Stop a specific race
    stopWarmup(warmupId: string): void {
        const warmup = this.warmups.get(warmupId);
        if (warmup) {
            warmup.stop();
        }
    }

    // Remove a race (cleanup)
    removeWarmup(warmupId: string): void {
        const warmup = this.warmups.get(warmupId);
        if (warmup) {
            warmup.stop();
            this.warmups.delete(warmupId);
            console.log(`Removed warmup ${warmupId}`);
        }
    }

    // Get all active races
    getActiveWarmups(): string[] {
        return Array.from(this.warmups.keys());
    }

    // Cleanup all races
    shutdown(): void {
        console.log('Shutting down all races...');
        this.warmups.forEach(warmup => warmup.stop());
        this.warmups.clear();
    }
}
