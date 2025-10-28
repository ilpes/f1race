import {Path, Point, TrackData} from './physics';
import {LAPS_PER_RACE} from "./RaceManager";

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

const MAX_SPEED = 25;
const FRICTION = 0.9;
const ACCELERATION = 0.9;
const SLIDING_FRICTION = 4.1;
const CRASH_ROTATION_INITIAL = 60;
const MIN_MOVE_VELOCITY = 0.1;

export class GameEngine {
    private drivers: Map<number, DriverState> = new Map();
    private inputQueues: Map<number, PlayerInput[]> = new Map();
    private tickNumber: number = 0;
    private readonly path: Path;
    private started: boolean = false;
    private readonly onDriverFinished: (driverNumber: number) => void;


    constructor(trackData: TrackData, onDriverFinished: (driverNumber: number) => void) {
        this.path = new Path(trackData);
        this.onDriverFinished = onDriverFinished;
    }

    addDriver(driverNumber: number): void {
        const trackPoint = this.path.getPointAt(0);
        const trackTangent = this.path.getTangentAt(0);

        const trackSpeed = new Point(0, 0);
        trackSpeed.length = 0;

        // const trackAngle = new Point(0, 0);
        // trackAngle.length = 0;

        this.drivers.set(driverNumber, {
            position: {
                point: trackPoint,
                speed: trackSpeed,
                angle: trackTangent.angle,
                distance: 0
            },
            laps: 0,
            isSpeedingUp: false,
            onTrack: true,
            crashPosition: null,
            crashPath: null,
            crashRotation: 0,
            finished: false,
            connected: true,
        });

        this.inputQueues.set(driverNumber, []);
        console.log(`Driver ${driverNumber} added`);
    }

    connectDriver(driverNumber: number): void {
        const driver = this.drivers.get(driverNumber);
        if (!driver) {
            return;
        }
        driver.connected = true;
    }

    disconnectDriver(driverNumber: number): void {
        const driver = this.drivers.get(driverNumber);
        if (!driver) {
            return;
        }
        driver.connected = false;
        driver.isSpeedingUp = false;
    }

    queueInput(input: PlayerInput): void {
        const queue = this.inputQueues.get(input.driverNumber);
        if (queue) {
            queue.push(input);
        }
    }

    private processInputs(): void {
        this.inputQueues.forEach((inputs, driverNumber) => {
            inputs.forEach(input => {
                this.processInput(driverNumber, input);
            });
            inputs.length = 0;
        });
    }

    private processInput(driverNumber: number, input: PlayerInput): void {
        const driver = this.drivers.get(driverNumber);
        if (!driver || driver.finished || !driver.connected) {
            return
        }

        if (input.action === 'speed-up') {
            driver.isSpeedingUp = true;
        } else if (input.action === 'brake') {
            driver.isSpeedingUp = false;
        }
    }

    update(): GameState {
        if (!this.started) {
            return this.serializeGameState();
        }

        this.processInputs();

        this.drivers.forEach((driver, driverNumber) => {
            if (driver.onTrack) {
                this.updateOnTrackPhysics(driverNumber, driver);
            } else {
                this.updateCrashPhysics(driverNumber, driver);
            }
        });

        this.tickNumber++;
        return this.serializeGameState();
    }

    private updateOnTrackPhysics(driverNumber: number, driver: DriverState): void {
        const position = driver.position;
        let length = position.speed.length;

        if (!driver.isSpeedingUp) {
            length *= FRICTION;
        } else {
            length += ACCELERATION;
            if (length > MAX_SPEED) {
                length = MAX_SPEED;
            }
        }

        // Don't move if too slow
        if (length <= MIN_MOVE_VELOCITY) {
            position.speed.length = length;
            return;
        }

        // Calculate next position
        const nextPosition = this.nextPosition(driver);

        if (!this.willMoveAt(nextPosition)) {
            return;
        }

        // Check for crash
        if (this.willCrashAt(driver, nextPosition)) {
            this.crash(driver);
            return;
        }

        // Update position
        this.updatePosition(driverNumber, driver, nextPosition);
    }

    private willMoveAt(nextPosition: Position): boolean {
        return nextPosition.speed.length > MIN_MOVE_VELOCITY;
    }

    private nextPosition(driver: DriverState): Position {
        const position = driver.position;
        let length = position.speed.length;

        if (!driver.isSpeedingUp) {
            length *= FRICTION;
        } else {
            length += ACCELERATION;
            if (length > MAX_SPEED) {
                length = MAX_SPEED;
            }
        }


        const trackOffset = position.distance % this.path.length;
        const trackPoint = this.path.getPointAt(trackOffset);
        const trackTangent = this.path.getTangentAt(trackOffset);

        const trackSpeed = new Point(0, 0);
        trackSpeed.length = length;

        // const trackAngle = new Point(0, 0)
        // trackAngle.angle = trackTangent.angle;

        return {
            point: trackPoint,
            speed: trackSpeed,
            angle: trackTangent.angle,
            distance: position.distance + length
        };
    }

    private willCrashAt(driver: DriverState, nextPosition: Position): boolean {
        const offset = this.path.getOffsetOf(nextPosition.point);
        const offsetPrev = this.path.getOffsetOf(driver.position.point);
        const offsetMid = (offset + offsetPrev) / 2;

        const pointAngle = this.path.getTangentAt(offset).angle;
        const prevPointAngle = this.path.getTangentAt(offsetMid).angle;
        const direction = prevPointAngle > pointAngle ? 1 : -1;

        const normalAtPosition = this.path.getNormalAt(offset).multiply(1000 * direction);
        const normalAtPoint = this.path.getNormalAt(offsetPrev).multiply(1000 * direction);

        // Create lines for intersection check
        const l1 = this.createLine(
            nextPosition.point,
            nextPosition.point.add(normalAtPosition)
        );

        const l2 = this.createLine(
            this.path.getPointAt(offsetPrev),
            this.path.getPointAt(offsetPrev).add(normalAtPoint)
        );

        const intersections = l1.getIntersections(l2);


        if (intersections.length <= 0) {
            return false;
        }

        const midpoint = driver.position.point.add(nextPosition.point).divide(2);
        const distance = intersections[0].point.getDistance(midpoint);
        const maxSpeed = Math.sqrt(distance * SLIDING_FRICTION);

        if (maxSpeed <= 0.05) {
            return false;
        }

        return nextPosition.speed.length > maxSpeed;
    }

    private createLine(p1: Point, p2: Point): Path {
        // Create a simple 2-point path for intersection testing
        const lineData: TrackData = {
            points: [
                {
                    x: p1.x,
                    y: p1.y,
                    angle: p1.getAngle(p2),
                    tangent: {x: 1, y: 0, angle: 0, length: 1},
                    normal: {x: 0, y: 1, angle: 90, length: 1},
                    offset: 0
                },
                {
                    x: p2.x,
                    y: p2.y,
                    angle: p1.getAngle(p2),
                    tangent: {x: 1, y: 0, angle: 0, length: 1},
                    normal: {x: 0, y: 1, angle: 90, length: 1},
                    offset: p1.getDistance(p2)
                }
            ],
            length: p1.getDistance(p2),
            name: 'line',
            closed: false,
            bounds: {x: 0, y: 0, width: 0, height: 0}
        };

        return new Path(lineData);
    }

    private crash(driver: DriverState): void {
        driver.crashRotation = CRASH_ROTATION_INITIAL;

        const position = driver.position;
        driver.crashPosition = {
            point: position.point.clone(),
            speed: position.speed.clone(),
            angle: position.angle,
            distance: 0
        };

        const p = new Point(0, 0)
        p.length = position.speed.length;
        p.angle = position.angle;

        // Create crash path
        driver.crashPath = this.createLine(
            position.point,
            position.point.add(p.multiply(50))
        );

        driver.isSpeedingUp = false;
        driver.onTrack = false;
    }

    private updatePosition(driverNumber: number, driver: DriverState, nextPosition: Position): void {
        const nextDistance = driver.position.distance + nextPosition.speed.length;
        const lap = Math.floor(nextDistance / this.path.length);
        const lapCompleted = driver.laps < lap;

        driver.laps = lap;
        driver.position = nextPosition;

        if (lapCompleted) {
            //console.log(`Driver completed lap ${driver.laps}`);
        }

        if (lapCompleted && lap === LAPS_PER_RACE) {
            this.onDriverFinished(driverNumber)
            driver.isSpeedingUp = false;
            driver.finished = true;
        }
    }

    private updateCrashPhysics(driverNumber: number, driver: DriverState): void {
        if (!driver.crashPosition || !driver.crashPath) {
            return;
        }

        const nextCrashPosition = this.nextCrashPosition(driver);

        if (!this.willMoveAt(nextCrashPosition)) {
            this.restartAfterCrash(driver);
            return;
        }

        this.updateCrashPosition(driver, nextCrashPosition);
    }

    private nextCrashPosition(driver: DriverState): Position {
        if (!driver.crashPosition || !driver.crashPath) {
            throw new Error('No crash position');
        }

        const trackOffset = driver.crashPosition.distance % driver.crashPath.length;
        const trackPoint = driver.crashPath.getPointAt(trackOffset);

        let length = driver.crashPosition.speed.length;
        let angle = driver.crashPosition.angle;

        driver.crashRotation *= FRICTION;

        angle += driver.crashRotation;
        length *= FRICTION;

        const speed = new Point(0, 0);
        speed.length = length;

        return {
            point: trackPoint,
            speed: speed,
            angle: angle,
            distance: driver.crashPosition.distance + length
        };
    }

    private updateCrashPosition(driver: DriverState, nextPosition: Position): void {
        if (!driver.crashPosition) {
            return;
        }

        driver.crashPosition.speed = nextPosition.speed;
        driver.crashPosition.point = nextPosition.point;
        driver.crashPosition.distance = nextPosition.distance;
        driver.crashPosition.angle = nextPosition.angle;

        // Also update main position for rendering
        driver.position.point = nextPosition.point;
        driver.position.speed = nextPosition.speed;
        driver.position.angle = nextPosition.angle;
    }

    private restartAfterCrash(driver: DriverState): void {
        //console.log('Driver recovered from crash');

        driver.onTrack = true;
        driver.crashPosition = null;
        driver.crashPath = null;
        driver.position.speed.length = 0;

        // Snap back to track
        const trackOffset = driver.position.distance % this.path.length;
        const trackPoint = this.path.getPointAt(trackOffset);
        const trackTangent = this.path.getTangentAt(trackOffset);

        driver.position.point = trackPoint;
        driver.position.angle = trackTangent.angle;
    }

    serializeGameState(): GameState {
        const driverStates: { [driverNumber: string]: SerializedDriverState } = {};

        this.drivers.forEach((driver, driverNumber) => {
            driverStates[driverNumber] = {
                x: driver.position.point.x,
                y: driver.position.point.y,
                rotation: driver.position.angle,
                distance: driver.position.distance,
                laps: driver.laps,
                velocity: driver.position.speed.length,
                isSpeedingUp: driver.isSpeedingUp,
                onTrack: driver.onTrack,
                finished: driver.finished
            };
        });

        return {
            drivers: driverStates,
            serverTime: Date.now(),
            tickNumber: this.tickNumber
        };
    }

    start(): void {
        this.started = true;
    }
}
