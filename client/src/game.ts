import {Car} from "./car.ts";

export class Game {
    private raceId: string;
    private driverPosition: number;
    private car: Car;

    constructor(
        document: Document,
        car: Car,
    ) {
        this.car = car;

        document.body.addEventListener('mousedown', () => this.speedUp());
        document.body.addEventListener('mouseup', () => this.brake());
    }

    render(): void {
       this.car.move();
    }

    speedUp(): void {
        this.car.speedUp();
    }

    brake(): void {
        this.car.break();
    }
}
