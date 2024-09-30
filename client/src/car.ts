import {Layer, Path, Point} from "paper";

const MAX_SPEED: number = 23;
const FRICTION: number = 0.9;
const ACCELERATION: number = 0.8;
const SLIDING_FRICTION: number = 4.1;

class Position {

    private trackPoint: Point;
    private trackSpeed: Point;
    private trackDistance: number;

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

    setPoint(point: Point): void {
        this.trackPoint = point;
    }

    setDistance(distance: number) {
        this.trackDistance = distance;
    }
}

export class Car {

    private image: HTMLImageElement;
    private layer: Layer;

    // Track
    private path: Path;
    private position: Position;

    // Crash
    private crashPosition: Position | null;
    private crashPath: Path;
    private crashRotation: number;

    private isSpeedingUp: boolean = false;
    private onTrack: boolean = true;

    constructor(container: HTMLElement, image: string, path: Path) {
        this.path = path;

        this.addLayer();
        this.addImage(container, image);
        this.setInitialPosition();
        this.updateCarPosition(this.position);
    }

    private addLayer() {
        this.layer = new Layer();
    }

    private addImage(container: HTMLElement, image: string) {
        this.image = new Image()
        this.image.src = image;
        this.image.className = 'car';
        container.append(this.image);
    }

    private updateCarPosition(position: Position | null) {

        if (position === null) {
            return;
        }

        let rotation = position.angle().toFixed(10);

        let x = position.x().toFixed(20);
        let y = position.y().toFixed(20);

        this.image.style['transform'] = 'translate3d(' + x + 'px, ' + y + 'px, 0px) rotate(' + rotation + 'deg)';
    }



    private updatePosition(nextPosition: Position): void {

        this.position.setSpeed(nextPosition.angle(), nextPosition.length());
        this.position.setPoint(nextPosition.point());
        this.position.setDistance(this.position.distance() + nextPosition.length());

        this.updateCarPosition(this.position);
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

    private setInitialPosition(): void {
        const position: Point = this.path.getPointAt(0);
        const tangent = this.path.getTangentAt(0);

        this.position = new Position({
          point: position,
          angle: tangent.angle,
          length: 0,
        });
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

        if (parseFloat(prevPointAngle) > parseFloat(pointAngle)) {
            direction = 1;
        }

        let normalAtPosition = this.path.getNormalAt(offset).multiply(1000 * direction);
        let normalAtPoint = this.path.getNormalAt(offsetPrev).multiply(1000 * direction);

        let l1 = this.drawLine(
            nextPosition.point(),
            nextPosition.point().add(normalAtPosition),
            null, 0
        );

        let l2 = this.drawLine(
            this.path.getPointAt(offsetPrev),
            this.path.getPointAt(offsetPrev).add(normalAtPoint),
            '#2895FF',
            0
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

        if (maxSpeed <= 0) {
            return false;
        }

        return nextPosition.length() > maxSpeed;
    }

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
