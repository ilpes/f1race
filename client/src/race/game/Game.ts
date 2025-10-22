// import {CurrentDriver, Driver} from "./Driver.ts";

import {Track} from "./Track.ts";
// import {throttle} from "lodash";
// import {DriverPosition, DriverData, RaceStatus, MouseEventFunction} from "../../types.ts";
//
// const LAPS: number = 3;
// const TICK_INTERVAL: number = 16;

import {DriverData, RaceStatus} from "../../types.ts";
import {Driver} from "./Driver.ts";
import CarImage from "./assets/car.png";
import Path = paper.Path;

export class Game {
    // @ts-ignore
    private readonly raceId: string;
    // private readonly position: number;
    //
    // private driver: CurrentDriver;
    private drivers: Array<Driver> = [];
    private driverNumber: number;
    //
    private track: Track;
    private container: HTMLElement;
    // private onUpdate: Function;
    // private onFinish: Function;
    private onSpeedUp: Function;
    private onBrake: Function;
    private started: boolean = false;

    // @todo: on driver disconnect, if it's me remove events (?)


    constructor(options: {
        raceId: string,
        driverNumber: number,
        document: Document,
        container: HTMLElement,
        trackSvg: SVGElement,
        onSpeedUp: Function
        onBrake: Function
        //onUpdate: Function,
        //onFinish: Function,
    }) {
        this.raceId = options.raceId;
        this.driverNumber = options.driverNumber;
        this.container = options.container;
        // this.onUpdate = options.onUpdate;
        // this.onFinish = options.onFinish;
        this.onSpeedUp = options.onSpeedUp;
        this.onBrake = options.onBrake;

        this.track = new Track(options.trackSvg);
    }

    getTrackPath(): Path {
        return this.track.getPath();
    }

    // addCurrentDriver(data) {
    //     if (this.driver === null) {
    //         const driver = new CurrentDriver(
    //             this.container,
    //             CarImage as string,
    //             this.track.getPath(),
    //             data.data,
    //             data.result,
    //             (data: DriverPosition) => this.onPositionUpdate(data),
    //             (laps: number) => this.onLapCompleted(laps),
    //         );
    //
    //         driver.setStatus(data.status);
    //         this.driver = driver;
    //
    //         return;
    //     }
    //
    //     this.driver.setStatus('connected');
    //     this.driver.setPosition(data);
    // }

    // driverJoined(position: number, data: DriverPosition | null) {
    //
    //     if (position === this.position) {
    //         this.addCurrentDriver(data);
    //
    //         return;
    //     }
    //
    //     const driver = this.getDriver(position);
    //
    //     if (driver === null) {
    //         this.addDriver({
    //             position: position,
    //             status: 'connected',
    //             data: data,
    //             result: null,
    //         });
    //
    //         return;
    //     }
    //
    //     driver.setStatus('connected');
    //     driver.setPosition(data);
    // }

    // driverLeft(position: number): void
    // {
    //     const driver = this.getDriver(position);
    //
    //     if (driver === null) {
    //         return;
    //     }
    //
    //     driver.setStatus('disconnected');
    // }

    // private throttleUpdate = throttle((data: DriverPosition) => {
    //     this.onUpdate(data);
    // }, TICK_INTERVAL); // ~60fps

    // onPositionUpdate(data: DriverPosition) {
    //     this.throttleUpdate(data)
    // }

    // addDriver(data: DriverData) {
    //     const driver = new Driver(
    //         this.container,
    //         CarImage as string,
    //         this.track.getPath(),
    //         data.data,
    //         data.result,
    //     );
    //
    //     driver.setStatus(data.status);
    //     this.drivers[data.position - 1] = driver;
    // }

    // onLapCompleted(laps: number) {
    //     console.log(`Lap #${laps} completed...`);
    //
    //     if (laps < LAPS) {
    //         return;
    //     }
    //
    //     this.finish();
    // }

    addOrUpdateDriver(data: DriverData) {
        let driver = this.getDriver(data.position);
        if (driver !== null) {
            driver.setPosition(data.data);
            driver.setStatus('connected');
            return;
        }

        driver = new Driver(
            this.container,
            CarImage as string,
            data.position,
            data.position === this.driverNumber ? 'manual' : 'auto',
            this.track.getPath(),
            data.data,
            data.result,
            // (data: DriverPosition) => this.onPositionUpdate(data),
            // (laps: number) => this.onLapCompleted(laps),
        );
        this.drivers[data.position - 1] = driver;
    }

    driverJoined(_driverNumber: number, drivers: Array<DriverData>, _status: RaceStatus) {
        for (const driverData of drivers) {
            this.addOrUpdateDriver(driverData);
        }



        if (drivers.length === 2) {
            console.log("Starting...")
            this.start()
        }

        // // @todo: add remaining statuses
        // switch (status) {
        //     case "started":
        //         if (this.me().hasFinished()) {
        //             return;
        //         }
        //
        //         this.start();
        //         break;
        //
        //     default:
        //         break;
        // }
    }
    //
    // finish(): void {
    //     console.log('Race finished...');
    //
    //     document.body.removeEventListener('mousedown', this.onSpeedUp);
    //     document.body.removeEventListener('mouseup', this.onBrake);
    //
    //     this.onFinish();
    //     this.me().stop();
    // }
    //
    start(): void {
        if (this.started) {
            return
        }

        console.log("Starting game...");

        this.started = true;

        document.body.addEventListener('mousedown', this.speedUp.bind(this));
        document.body.addEventListener('mouseup', this.brake.bind(this));

        requestAnimationFrame(() => this.render());
    }
    //
    getDriver(driverNumber: number): Driver | null {
        return this.drivers[driverNumber - 1] ?? null;
    }

    // private me(): Driver | null {
    //     return this.drivers[this.driverNumber - 1];
    // }

    render(): void {
        //console.log('rendering...');

        for (const driver of this.drivers) {
            driver.move();
        }

        requestAnimationFrame(() => this.render())
    }
    //
    // update(position:number, data: DriverPosition | null) {
    //     if (data === null) {
    //         return;
    //     }
    //
    //     this
    //         .getDriver(position)
    //         ?.update(data.x.toString(), data.y.toString(), data.rotation.toString());
    // }

    private speedUp(): void {
        this.onSpeedUp(this.driverNumber);
    }

    private brake(): void {
        this.onBrake(this.driverNumber);
    }

    driverBraked(driverNumber: number): void {
        this.getDriver(driverNumber)?.break();
    }

    driverSpedUp(driverNumber: number): void {
        this.getDriver(driverNumber)?.speedUp();
    }
}
