import {Layer, Point, Path} from "paper";
import {DriverPosition, DriverResult, DriverStatus, OnDriverPositionUpdate, OnLapCompleted} from "../../types.ts";

const MAX_SPEED: number = 23;
const FRICTION: number = 0.9;
const ACCELERATION: number = 0.8;
const SLIDING_FRICTION: number = 4.1;

export class Position {

    // @ts-ignore
    private trackPoint: Point;

    // @ts-ignore
    private trackSpeed: Point;
    private trackDistance: number;

    // @ts-ignore
    constructor(param: {point: Point, angle: number, length: number, distance?: number}) {

        this.trackPoint = param.point;

        this.trackSpeed = new Point(0, 0);
        this.trackSpeed.angle = param.angle;
        this.trackSpeed.length = param.length;

        this.trackDistance = param.distance ?? 0;
    }

    // Speed
    speed() {
        return this.trackSpeed;
    }

    angle() {
        return this.trackSpeed.angle;
    }

    length() {
        return this.trackSpeed.length;
    }

    // X and Y
    point() {
        return this.trackPoint;
    }

    x() {
        return this.trackPoint.x;
    }

    y() {
        return this.trackPoint.y;
    }


    // Partial distance
    distance() {
        return this.trackDistance;
    }

    setSpeed(angle: number | null, length: number | null){
        const newAngle = angle ?? this.trackSpeed.angle;
        const newLength = length ?? this.trackSpeed.length;

        this.trackSpeed = new Point(0, 0);
        this.trackSpeed.angle = newAngle;
        this.trackSpeed.length = newLength;
    }

    // @ts-ignore
    setPoint(point: Point): void {
        this.trackPoint = point;
    }

    setDistance(distance: number) {
        this.trackDistance = distance;
    }
}

export class Driver {

    private isMe: boolean;

    // @ts-ignore
    private status: DriverStatus;

    private image: HTMLImageElement;

    // Track
    // @ts-ignore
    private path: Path;
    private position: Position;

    // Crash
    private crashPosition: Position | null;

    // @ts-ignore
    private crashPath: Path;
    private crashRotation: number;

    private isSpeedingUp: boolean = false;
    private onTrack: boolean = true;
    private result: DriverResult | null = null;

    private onPositionUpdate: OnDriverPositionUpdate;
    private onLapCompleted: OnLapCompleted;

    private laps: number = 0;

    constructor(
        container: HTMLElement,
        image: string,

        // @ts-ignore
        path: Path,
        isMe: boolean,
        onPositionUpdate: OnDriverPositionUpdate,
        onLapCompleted: OnLapCompleted,
        initialPosition: DriverPosition | null = null,
        result: DriverResult | null = null,
    ) {
        this.path = path;
        this.isMe = isMe;
        this.result = result;
        this.onPositionUpdate = onPositionUpdate;
        this.onLapCompleted = onLapCompleted;

        this.addLayer();
        this.addImage(container, image);
        this.setInitialPosition(initialPosition);
        this.updateCarPosition(this.position);
    }

    private addLayer() {
        new Layer();
    }

    hasFinished(): boolean {
        return this.result !== null;
    }

    private addImage(container: HTMLElement, image: string) {
        this.image = new Image()
        this.image.src = image;
        this.image.className = 'car';

        if (!this.isMe) {
            this.image.style.opacity = '.5';
        }

        container.append(this.image);
    }

    update(x: string, y: string, rotation: string) {
        this.image.style['transform'] = 'translate3d(' + x + 'px, ' + y + 'px, 0px) rotate(' + rotation + 'deg)';
    }

    private updateCarPosition(position: Position | null, lapCompleted: boolean = false) {

        if (position === null) {
            return;
        }

        let rotation = position.angle().toFixed(10);

        let x = position.x().toFixed(20);
        let y = position.y().toFixed(20);

        this.update(x, y, rotation);

        if (!this.isMe) {
            return;
        }

        this.onPositionUpdate({
            x: position.x(),
            y: position.y(),
            rotation: position.angle(),
            laps: this.laps,
            distance: position.distance(),
        });

        if (!lapCompleted) {
            return;
        }

        this.onLapCompleted(this.laps);
    }

    setStatus(status: DriverStatus | undefined): void {
        if (status === undefined) {
            return;
        }

        this.status = status;
    }

    private updatePosition(nextPosition: Position): void {

        const nextDistance = this.position.distance() + nextPosition.length();
        const lap = Math.floor(nextDistance / this.path.length);
        const lapCompleted: boolean = this.laps < lap;

        this.laps = Math.floor(nextDistance / this.path.length);
        this.position.setSpeed(nextPosition.angle(), nextPosition.length());
        this.position.setPoint(nextPosition.point());
        this.position.setDistance(nextDistance);

        // Update car position and triggers the update event
        this.updateCarPosition(this.position, lapCompleted);
    }

    private nextPosition(): Position {

        let length = this.position.length();

        if (!this.isSpeedingUp) {
            length *= FRICTION;
        } else {
            length += ACCELERATION;
            if (length > MAX_SPEED) {
                length = MAX_SPEED;
            }
        }

        let trackOffset = this.position.distance() % this.path.length;
        let trackPoint = this.path.getPointAt(trackOffset);
        let trackTangent = this.path.getTangentAt(trackOffset);

        return new Position({
            point: trackPoint,
            angle: trackTangent.angle,
            length: length,
        });

    }

    private crash() {

        // Restore initial crash rotation
        this.crashRotation = 60;

        // Store crash position
        this.crashPosition = new Position({
            point: this.position.point(),
            angle: this.position.angle(),
            length: this.position.length(),
        });

        // Draw crash path
        this.crashPath = this.drawLine(
            this.position.point(),
            this.position.point().add(this.position.speed().multiply(50)),
            null,
            0
        );

        this.break();
    }

    private updateCrashPosition(nextPosition: Position): void {
        this.crashPosition?.setSpeed(nextPosition.angle(), nextPosition.length());
        this.crashPosition?.setPoint(nextPosition.point());
        this.crashPosition?.setDistance(this.crashPosition?.distance() + nextPosition.length());

        this.updateCarPosition(this.crashPosition);
    }

    private nextCrashPosition(): Position {
        let trackOffset = this.crashPosition?.distance() % this.crashPath.length;
        let trackPoint = this.crashPath.getPointAt(trackOffset);

        let length = this.crashPosition?.length();
        let angle = this.crashPosition?.angle();

        this.crashRotation *= FRICTION;

        angle += this.crashRotation;
        length *= FRICTION;

        return new Position({
            point: trackPoint,
            angle: angle,
            length: length
        });
    }

    private setInitialPosition(initialPosition: DriverPosition | null): void {
        if (initialPosition === null) {
            // @ts-ignore
            const position: Point = this.path.getPointAt(0);

            // @ts-ignore
            const tangent: Point = this.path.getTangentAt(0);

            this.position = new Position({
                point: position,
                angle: tangent.angle,
                length: 0,
                distance: 0,
            });

            return;
        }

        const offset = initialPosition.distance % this.path.length

        // @ts-ignore
        const position: Point = this.path.getPointAt(offset);

        // @ts-ignore
        const tangent: Point = this.path.getTangentAt(offset);

        this.laps = initialPosition.laps;
        this.position = new Position({
            point: position,
            angle: tangent.angle,
            length: 0,
            distance: initialPosition.distance
        });
    }

    setPosition(driverPosition: DriverPosition | null) {
        if (driverPosition === null) {
            return;
        }

        const offset = driverPosition.distance % this.path.length

        // @ts-ignore
        const position: Point = this.path.getPointAt(offset);

        // @ts-ignore
        const tangent: Point = this.path.getTangentAt(offset);

        this.laps = driverPosition.laps;
        this.position = new Position({
            point: position,
            angle: tangent.angle,
            length: 0,
            distance: driverPosition.distance
        });

        this.updateCarPosition(this.position);
    }

    speedUp() {
        if (!this.onTrack) {
            return;
        }

        this.isSpeedingUp = true;
    }

    break() {
        if (!this.onTrack) {
            return;
        }

        this.isSpeedingUp = false;
    }

    private willMoveAt(nextPosition: Position): boolean {
        return nextPosition.length() > 0.1;
    }

    private willCrashAt(nextPosition: Position): boolean {
        let offset = this.path.getOffsetOf(nextPosition.point());
        let offsetPrev = this.path.getOffsetOf(this.position.point());
        let offsetMid = (offset + offsetPrev) / 2;

        let pointAngle = this.path.getTangentAt(offset).angle;
        let prevPointAngle = this.path.getTangentAt(offsetMid).angle;
        let direction = -1;

        if (prevPointAngle > pointAngle) {
            direction = 1;
        }

        let normalAtPosition = this.path.getNormalAt(offset).multiply(1000 * direction);
        let normalAtPoint = this.path.getNormalAt(offsetPrev).multiply(1000 * direction);

        let l1 = this.drawLine(
            nextPosition.point(),
            nextPosition.point().add(normalAtPosition),
            null,
            2
        );

        let l2 = this.drawLine(
            this.path.getPointAt(offsetPrev),
            this.path.getPointAt(offsetPrev).add(normalAtPoint),
            '#2895FF',
            2
        );

        let intersection = l1.getIntersections(l2);

        l1.remove();
        l2.remove();

        if (intersection.length <= 0) {
            return false;
        }

        let midpoint = this.position.point().add(nextPosition.point()).divide(2);
        let distance = intersection[0].point.getDistance(midpoint);
        const maxSpeed = Math.sqrt(distance * SLIDING_FRICTION);

        if (maxSpeed <= .05) {
            return false;
        }

        return nextPosition.length() > maxSpeed;
    }

    // @ts-ignore
    private drawLine(p1: Point, p2: Point, color: string | null, size: number) {
        return new Path({
            segments: [p1, p2],
            strokeColor: color ?? '#AAE727',
            strokeWidth: size ?? 0,
        });
    }

    private restartAfterCrash() {
        this.crashPath.remove();
        this.position.setSpeed(null, 0);

        this.updateCarPosition(this.position);
        this.onTrack = true;
    }

    stop() {
        this.break();
    }

    move() {

        if (this.onTrack) {

            const nextPosition = this.nextPosition();

            if (!this.willMoveAt(nextPosition)) {
                return;
            }

            if (!this.willCrashAt(nextPosition)) {
                this.updatePosition(nextPosition);
                return;
            }

            this.crash();
            this.onTrack = false;
            return;
        }

        const nextCrashPosition = this.nextCrashPosition();

        if (!this.willMoveAt(nextCrashPosition)) {
            this.restartAfterCrash();
            return;
        }

        this.updateCrashPosition(nextCrashPosition);
    }


}
