import {GameEngine} from "./GameEngine";
import {clearInterval} from "node:timers";
import {GameState, PlayerInput, RaceConfig, RaceResult, RaceStatus} from "../types";

const TICK_RATE = 60; // 60 ticks per second
const TICK_INTERVAL = 1000 / TICK_RATE;

export class Race {

    public raceId: string;
    public gameEngine: GameEngine;
    private intervalId: NodeJS.Timeout | null = null;
    private readonly onStateUpdate: (state: GameState) => void;
    private readonly maxDrivers: number;
    private drivers: Map<number, number | null> = new Map();
    private status: RaceStatus;
    private startedAt: number | null = null;
    private finishedAt: number | null = null;
    private readonly onRaceFinished: (time: number) => void;

    constructor(
        config: RaceConfig,
        onStateUpdate: (state: GameState) => void,
        onDriverFinished: (driverNumber: number, time: number) => void,
        onRaceFinished: (time: number) => void,
    ) {
        this.raceId = config.raceId;
        this.gameEngine = new GameEngine(
            config.trackData,
            (driverNumber) => {
                const now = Date.now()
                this.drivers.set(driverNumber, now);
                onDriverFinished(driverNumber, now)
            });

        this.status = 'waiting';
        this.onRaceFinished = onRaceFinished;
        this.onStateUpdate = onStateUpdate;
        this.maxDrivers = config.maxDrivers;
    }

    getResult(): RaceResult | null {
        if (this.status !== 'finished') {
            return null;
        }

        let result: RaceResult = {}
        let sortedDrivers: Array<[string, number]> = [];

        // First pass: collect all valid drivers and sort by time
        for (const [key, value] of this.drivers) {
            if (value === null) {
                return null;
            }
            sortedDrivers.push([String(key), value]);
        }

        // Sort by time (ascending - lowest time wins)
        sortedDrivers.sort((a, b) => a[1] - b[1]);

        // Get the winning time (fastest time)
        const winningTime = sortedDrivers[0][1];

        // Second pass: build the result with position and distance
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

    // Add a driver to this race
    addDriver(driverNumber: number): void {
        if (this.hasDriver(driverNumber)) {
            console.log(`Driver ${driverNumber} already in race ${this.raceId}`);
            return;
        }

        this.drivers.set(driverNumber, null);
        this.gameEngine.addDriver(driverNumber);
        console.log(`Driver ${driverNumber} added to race ${this.raceId}`);
    }

    connectDriver(driverNumber: number): void {
        if (!this.hasDriver(driverNumber)) {
            console.log(`Driver ${driverNumber} not in race ${this.raceId}`);
            return;
        }
        this.gameEngine.connectDriver(driverNumber);
    }

    disconnectDriver(driverNumber: number): void {
        if (!this.hasDriver(driverNumber)) {
            console.log(`Driver ${driverNumber} not in race ${this.raceId}`);
            return;
        }
        this.gameEngine.disconnectDriver(driverNumber);
    }

    // Queue input from a driver
    queueInput(input: PlayerInput): void {
        this.gameEngine.queueInput(input);
    }

    // Start the game loop
    start(): void {
        if (this.intervalId) {
            console.log(`Race ${this.raceId} already started`);
            return;
        }

        console.log(`Starting race ${this.raceId}`);
        this.status = 'started';
        this.startedAt = Date.now();
        this.gameEngine.start();

        // Start fixed-rate game loop
        this.intervalId = setInterval(() => {
            this.tick();
        }, TICK_INTERVAL);
    }

    starting() {
        this.status = 'starting'
    }

    // Single game tick
    private tick(): void {
        // Update game state
        const gameState = this.gameEngine.update();

        // Serialize and broadcast
        const serialized = this.gameEngine.serializeGameState();
        this.onStateUpdate(serialized);

        if (this.finished()) {
            this.finish();
        }
    }

    finish(): void {
        const now = Date.now();
        this.finishedAt = now;
        this.status = 'finished';
        this.onRaceFinished(now);
    }

    finished(): boolean {
        if (this.status === 'finished') {
            return false;
        }

        if (this.getDriverCount() < this.maxDrivers) {
            return false;
        }

        for (const finishedAt of this.drivers.values()) {
            if (finishedAt === null) {
                return false;
            }
        }

        return true;
    }

    // Stop the game loop
    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log(`Race ${this.raceId} stopped`);
        }
    }

    hasDriver(driverNumber: number): boolean {
        return this.drivers.has(driverNumber);
    }

    // Check if race is running
    isRunning(): boolean {
        return this.intervalId !== null;
    }

    // Get number of drivers
    getDriverCount(): number {
        return this.drivers.size;
    }

    // Check if race is full
    isFull(): boolean {
        return this.drivers.size >= this.maxDrivers;
    }

    // Get the status
    getStatus(): RaceStatus {
        return this.status;
    }

    getStartedAt(): number | null {
        return this.startedAt;
    }

    getFinishedAt(): number | null {
        return this.finishedAt;
    }
}
