/**
 * Paper.js-compatible Point class for server-side
 * Implements most commonly used Point methods from Paper.js
 */

export class Point {
    public x: number;
    public y: number;

    constructor(x: number | Point | [number, number], y?: number) {
        if (typeof x === 'number') {
            this.x = x;
            this.y = y ?? 0;
        } else if (x instanceof Point) {
            this.x = x.x;
            this.y = x.y;
        } else if (Array.isArray(x)) {
            this.x = x[0];
            this.y = x[1];
        } else {
            this.x = 0;
            this.y = 0;
        }
    }

    // ===== Basic Operations =====

    add(point: Point | number): Point {
        if (typeof point === 'number') {
            return new Point(this.x + point, this.y + point);
        }
        return new Point(this.x + point.x, this.y + point.y);
    }

    subtract(point: Point | number): Point {
        if (typeof point === 'number') {
            return new Point(this.x - point, this.y - point);
        }
        return new Point(this.x - point.x, this.y - point.y);
    }

    multiply(value: number | Point): Point {
        if (typeof value === 'number') {
            return new Point(this.x * value, this.y * value);
        }
        return new Point(this.x * value.x, this.y * value.y);
    }

    divide(value: number | Point): Point {
        if (typeof value === 'number') {
            return new Point(this.x / value, this.y / value);
        }
        return new Point(this.x / value.x, this.y / value.y);
    }

    // ===== Distance & Length =====

    get length(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    set length(value: number) {
        const currentLength = this.length;
        if (currentLength !== 0) {
            const scale = value / currentLength;
            this.x *= scale;
            this.y *= scale;
        } else {
            this.x = Math.cos(this.angle) * value;
            this.y = Math.sin(this.angle) * value;
        }
    }

    getDistance(point: Point, squared?: boolean): number {
        const dx = this.x - point.x;
        const dy = this.y - point.y;
        const distSquared = dx * dx + dy * dy;
        return squared ? distSquared : Math.sqrt(distSquared);
    }

    // ===== Angle =====

    get angle(): number {
        return Math.atan2(this.y, this.x) * 180 / Math.PI;
    }

    set angle(degrees: number) {
        const length = this.length;
        const radians = degrees * Math.PI / 180;
        this.x = Math.cos(radians) * length;
        this.y = Math.sin(radians) * length;
    }

    getAngle(point?: Point): number {
        if (point) {
            return Math.atan2(point.y - this.y, point.x - this.x) * 180 / Math.PI;
        }
        return this.angle;
    }

    getDirectedAngle(point: Point): number {
        const angle = this.getAngle(point);
        return angle < 0 ? angle + 360 : angle;
    }

    // ===== Normalization & Rotation =====

    normalize(length?: number): Point {
        const currentLength = this.length;
        const scale = currentLength !== 0 ? (length ?? 1) / currentLength : 0;
        return new Point(this.x * scale, this.y * scale);
    }

    rotate(angle: number, center?: Point): Point {
        if (angle === 0) return new Point(this);

        const radians = angle * Math.PI / 180;
        const centerX = center?.x ?? 0;
        const centerY = center?.y ?? 0;

        const dx = this.x - centerX;
        const dy = this.y - centerY;
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);

        return new Point(
            centerX + dx * cos - dy * sin,
            centerY + dx * sin + dy * cos
        );
    }

    // ===== Dot & Cross Product =====

    dot(point: Point): number {
        return this.x * point.x + this.y * point.y;
    }

    cross(point: Point): number {
        return this.x * point.y - this.y * point.x;
    }

    // ===== Projection =====

    project(point: Point): Point {
        const scale = this.dot(point) / point.dot(point);
        return point.multiply(scale);
    }

    // ===== Comparison =====

    equals(point: Point): boolean {
        return this.x === point.x && this.y === point.y;
    }

    isClose(point: Point, tolerance: number = 0.00001): boolean {
        return Math.abs(this.x - point.x) < tolerance &&
            Math.abs(this.y - point.y) < tolerance;
    }

    isCollinear(point: Point): boolean {
        return Math.abs(this.cross(point)) < 0.00001;
    }

    isOrthogonal(point: Point): boolean {
        return Math.abs(this.dot(point)) < 0.00001;
    }

    isZero(): boolean {
        return this.x === 0 && this.y === 0;
    }

    isNaN(): boolean {
        return isNaN(this.x) || isNaN(this.y);
    }

    // ===== Rounding =====

    round(): Point {
        return new Point(Math.round(this.x), Math.round(this.y));
    }

    ceil(): Point {
        return new Point(Math.ceil(this.x), Math.ceil(this.y));
    }

    floor(): Point {
        return new Point(Math.floor(this.x), Math.floor(this.y));
    }

    abs(): Point {
        return new Point(Math.abs(this.x), Math.abs(this.y));
    }

    // ===== Min/Max =====

    min(point: Point): Point {
        return new Point(
            Math.min(this.x, point.x),
            Math.min(this.y, point.y)
        );
    }

    max(point: Point): Point {
        return new Point(
            Math.max(this.x, point.x),
            Math.max(this.y, point.y)
        );
    }

    // ===== Cloning & Conversion =====

    clone(): Point {
        return new Point(this.x, this.y);
    }

    toString(): string {
        return `{ x: ${this.x}, y: ${this.y} }`;
    }

    toArray(): [number, number] {
        return [this.x, this.y];
    }

    // ===== Static Methods =====

    static min(point1: Point, point2: Point): Point {
        return new Point(
            Math.min(point1.x, point2.x),
            Math.min(point1.y, point2.y)
        );
    }

    static max(point1: Point, point2: Point): Point {
        return new Point(
            Math.max(point1.x, point2.x),
            Math.max(point1.y, point2.y)
        );
    }

    static random(): Point {
        return new Point(Math.random(), Math.random());
    }

    // ===== Paper.js specific static constructors =====

    static fromAngle(angle: number, length: number = 1): Point {
        const radians = angle * Math.PI / 180;
        return new Point(
            Math.cos(radians) * length,
            Math.sin(radians) * length
        );
    }
}
