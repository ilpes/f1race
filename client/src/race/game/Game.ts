import {Driver} from "./Driver.ts";
import CarImage from "./assets/car.png";
import {Track} from "./Track.ts";
import {throttle} from "lodash";
import {DriverPosition, DriverData, RaceStatus, MouseEventFunction} from "../../types.ts";

const LAPS: number = 3;

export class Game {
    // @ts-ignore
    private readonly raceId: string;
    private readonly position: number;
    private drivers: Array<Driver> = [];
    private track: Track;
    private container: HTMLElement;
    private onUpdate: Function;
    private onFinish: Function;
    private onSpeedUp: MouseEventFunction;
    private onBrake: MouseEventFunction;

    constructor(options: {
        raceId: string,
        position: number,
        document: Document,
        container: HTMLElement,
        trackSvg: SVGElement,
        onUpdate: Function,
        onFinish: Function,
    }) {
        this.raceId = options.raceId;
        this.position = options.position;
        this.container = options.container;
        this.onUpdate = options.onUpdate;
        this.onFinish = options.onFinish;
        this.onSpeedUp = this.speedUp.bind(this);
        this.onBrake = this.brake.bind(this);

        this.track = new Track(options.trackSvg);
    }

    driverJoined(position: number, data: DriverPosition | null) {
        const driver = this.getDriver(position);

        if (driver === null) {
            this.addDriver({
                position: position,
                status: 'connected',
                data: data,
                result: null,
            });
            return;
        }

        driver.setStatus('connected');
        driver.setPosition(data);
    }

    driverLeft(position: number): void
    {
        const driver = this.getDriver(position);

        if (driver === null) {
            return;
        }

        driver.setStatus('disconnected');
    }

    private throttleUpdate = throttle((data: DriverPosition) => {
        this.onUpdate(data);
    }, 15); // ~60fps

    onPositionUpdate(data: DriverPosition) {
        this.throttleUpdate(data)
    }

    addDriver(data: DriverData) {
        const isMe = data.position === this.position;
        const driver = new Driver(
            this.container,
            CarImage as string,
            this.track.getPath(),
            isMe,
            (data: DriverPosition) => this.onPositionUpdate(data),
            (laps: number) => this.onLapCompleted(laps),
            data.data,
            data.result,
        );

        driver.setStatus(data.status);
        this.drivers[data.position - 1] = driver;
    }

    onLapCompleted(laps: number) {
        console.log(`Lap #${laps} completed...`);

        if (laps < LAPS) {
            return;
        }

        this.finish();
    }

    initialize(drivers: Array<DriverData>, status: RaceStatus) {
        for (const driverData of drivers) {
            const driver = this.getDriver(driverData.position);

            if (driver === null) {
                this.addDriver(driverData);
                continue;
            }

            driver.setStatus(driverData.status);
        }

        // @todo: add remaining statuses
        switch (status) {
            case "started":
                if (this.me().hasFinished()) {
                    return;
                }

                this.start();
                break;

            default:
                break;
        }
    }

    finish(): void {
        console.log('Race finished...');

        document.body.removeEventListener('mousedown', this.onSpeedUp);
        document.body.removeEventListener('mouseup', this.onBrake);

        this.onFinish();
        this.me().stop();
    }

    start(): void {
        console.log('Game started!');

        document.body.addEventListener('mousedown', this.onSpeedUp);
        document.body.addEventListener('mouseup', this.onBrake);

        requestAnimationFrame(() => this.render());
    }

    getDriver(position: number): Driver | null {
        return this.drivers[position - 1] ?? null;
    }

    private me(): Driver {
        return <Driver>this.getDriver(this.position);
    }

    render(): void {
        this.me().move();

        requestAnimationFrame(() => this.render())
    }

    update(position:number, data: DriverPosition | null) {
        if (data === null) {
            return;
        }

        this
            .getDriver(position)
            ?.update(data.x.toString(), data.y.toString(), data.rotation.toString());
    }

    private speedUp(): void {
        this.me().speedUp();
    }

    private brake(): void {
        this.me().break();
    }
}
