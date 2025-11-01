import {Track} from "./Track.ts";
import {Driver} from "./Driver.ts";
import CarImage from "./assets/car.png";
// @ts-ignore
import {Path} from "paper";
import {GameState, RaceState, SerializedDriverState} from "../types.ts";

export class Game {
    private readonly raceId: string;
    private drivers: Map<number, Driver> = new Map();
    private readonly driverNumber: number;
    private readonly container: HTMLElement;
    private readonly onSpeedUp: Function;
    private readonly onBrake: Function;
    private started: boolean = false;

    // Interpolation state
    private gameStateBuffer: GameState[] = [];
    private renderDelay: number = 100; // 100ms buffer for interpolation
    private localInputSequence: number = 0;

    private track: Track;

    constructor(options: {
        raceId: string,
        driverNumber: number,
        document: Document,
        container: HTMLElement,
        trackSvg: SVGElement,
        onSpeedUp: Function
        onBrake: Function
    }) {
        this.raceId = options.raceId;
        this.driverNumber = options.driverNumber;
        this.container = options.container;
        this.onSpeedUp = options.onSpeedUp;
        this.onBrake = options.onBrake;
        this.track = new Track(options.trackSvg);

        // Start render loop
        requestAnimationFrame(() => this.render());

        console.log(`Race ${this.raceId} initialized...`);
    }

    getDriverNumber(): number {
        return this.driverNumber;
    }

    // @ts-ignore
    getTrackPath(): Path {
        return this.track.getPath()
    }

    addOrUpdateDriver(driverNum: number, data: SerializedDriverState) {
        let driver = this.getDriver(driverNum);
        if (driver === null) {
            driver = new Driver(
                this.container,
                CarImage as string,
                driverNum,
                driverNum === this.driverNumber ? 'manual' : 'auto',
            );
            this.drivers.set(driverNum, driver);
        }

        driver.update(
            data.x.toFixed(2),
            data.y.toFixed(2),
            data.rotation.toFixed(2),
        )
    }

    driverJoined(driverNumber: number, state: RaceState) {
        console.log(`Driver ${driverNumber} joined...`, `Race status: ${state.status}`);
        for (const driverNum in state.state.drivers) {
            const driverData = state.state.drivers[driverNum];
            this.addOrUpdateDriver(Number(driverNum), driverData);
        }

        if (state.status === 'started') {
            this.start()
        }
    }

    start(): void {
        if (this.started) {
            return
        }

        this.started = true;

        document.body.addEventListener('pointerdown', this.speedUp.bind(this));
        document.body.addEventListener('pointerup', this.brake.bind(this));
    }

    getDriver(driverNumber: number): Driver | null {
        return this.drivers.get(driverNumber) ?? null;
    }

    // Receive game state from server
    updateGameState(state: GameState): void {
        this.gameStateBuffer.push(state);

        // Keep buffer size reasonable (last 1 second worth of states)
        if (this.gameStateBuffer.length > 60) {
            this.gameStateBuffer.shift();
        }
    }

    // Interpolate between two states
    private interpolate(state0: GameState, state1: GameState, t: number): GameState {
        const interpolatedDrivers = {};

        for (const driverNum in state0.drivers) {
            const driver1 = state1.drivers[driverNum];
            const driver0 = state0.drivers[driverNum];
            if (!driver1) {
                return;
            }

            interpolatedDrivers[driverNum] = {
                x: this.lerp(driver0.x, driver1.x, t),
                y: this.lerp(driver0.y, driver1.y, t),
                rotation: this.lerpAngle(driver0.rotation, driver1.rotation, t),
                distance: this.lerp(driver0.distance, driver1.distance, t),
                laps: driver1.laps, // Don't interpolate integers
                isSpeedingUp: driver1.isSpeedingUp
            };
        }

        return {
            drivers: interpolatedDrivers,
            serverTime: this.lerp(state0.serverTime, state1.serverTime, t),
            tickNumber: state1.tickNumber
        };
    }

    private lerp(a: number, b: number, t: number): number {
        return a + (b - a) * t;
    }

    private lerpAngle(a: number, b: number, t: number): number {
        // Handle angle wrapping
        let diff = b - a;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        return a + diff * t;
    }

    // Render loop - interpolates between server states
    render(): void {
        if (!this.started) {
            requestAnimationFrame(() => this.render());
            return;
        }

        const now = Date.now();
        const renderTime = now - this.renderDelay;

        // Find two states to interpolate between
        let state0: GameState | null = null;
        let state1: GameState | null = null;

        for (let i = 0; i < this.gameStateBuffer.length - 1; i++) {
            if (this.gameStateBuffer[i].serverTime <= renderTime &&
                this.gameStateBuffer[i + 1].serverTime >= renderTime) {
                state0 = this.gameStateBuffer[i];
                state1 = this.gameStateBuffer[i + 1];
                break;
            }
        }

        if (state0 === null ||  state1 === null) {
            requestAnimationFrame(() => this.render());
            return;
        }

        // If we have two states, interpolate and render
        const t = (renderTime - state0.serverTime) / (state1.serverTime - state0.serverTime);
        const interpolatedState = this.interpolate(state0, state1, t);

        for (const driverNum in interpolatedState.drivers) {
            const driver = this.getDriver(Number(driverNum));
            const driverState = interpolatedState.drivers[driverNum];

            if (driver === null) {
                continue;
            }

            driver.update(
                driverState.x.toFixed(2),
                driverState.y.toFixed(2),
                driverState.rotation.toFixed(2)
            );
        }

        requestAnimationFrame(() => this.render());
    }

    private speedUp(): void {
        this.localInputSequence++;
        this.onSpeedUp(this.driverNumber, this.localInputSequence);
    }

    private brake(): void {
        this.localInputSequence++;
        this.onBrake(this.driverNumber, this.localInputSequence);
    }
}
