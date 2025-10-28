/**
 * Paper.js-compatible Path class for server-side
 * Loads pre-computed path data and provides Paper.js-like API
 */

import { Point } from './Point';

export interface PathPointData {
    x: number;
    y: number;
    angle: number;
    tangent: {
        x: number;
        y: number;
        angle: number;
        length: number;
    };
    normal: {
        x: number;
        y: number;
        angle: number;
        length: number;
    };
    offset: number;
}

export interface TrackData {
    points: PathPointData[];
    length: number;
    name: string;
    closed: boolean;
    bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}

export class Path {
    private readonly points: PathPointData[];
    public length: number;
    public closed: boolean;
    public bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    };

    constructor(trackData: TrackData) {
        this.points = trackData.points;
        this.length = trackData.length;
        this.closed = trackData.closed;
        this.bounds = trackData.bounds;
    }
    /**
     * Get point at a specific offset distance along the path
     */
    getPointAt(offset: number): Point {
        const data = this.getPathDataAt(offset);
        return new Point(data.x, data.y);
    }

    /**
     * Get tangent (direction vector) at a specific offset
     */
    getTangentAt(offset: number): Point {
        const data = this.getPathDataAt(offset);
        return new Point(data.tangent.x, data.tangent.y);
    }

    /**
     * Get normal (perpendicular vector) at a specific offset
     */
    getNormalAt(offset: number): Point {
        const data = this.getPathDataAt(offset);
        return new Point(data.normal.x, data.normal.y);
    }

    /**
     * Get the actual offset value (useful for closed paths)
     */
    getOffsetOf(point: Point): number {
        // Find closest point in our pre-computed data
        let minDistance = Infinity;
        let closestOffset = 0;

        for (const pathPoint of this.points) {
            const dx = pathPoint.x - point.x;
            const dy = pathPoint.y - point.y;
            const distance = dx * dx + dy * dy; // squared distance (faster)

            if (distance < minDistance) {
                minDistance = distance;
                closestOffset = pathPoint.offset;
            }
        }

        return closestOffset;
    }

    /**
     * Get location data at offset (includes point, tangent, normal, angle)
     */
    getLocationAt(offset: number): PathLocation {
        const data = this.getPathDataAt(offset);
        return new PathLocation(
            new Point(data.x, data.y),
            new Point(data.tangent.x, data.tangent.y),
            new Point(data.normal.x, data.normal.y),
            data.angle,
            offset,
            this
        );
    }

    /**
     * Check if point is inside path (for closed paths)
     * Simple implementation using ray casting
     */
    contains(point: Point): boolean {
        if (!this.closed) return false;

        let inside = false;
        for (let i = 0, j = this.points.length - 1; i < this.points.length; j = i++) {
            const xi = this.points[i].x;
            const yi = this.points[i].y;
            const xj = this.points[j].x;
            const yj = this.points[j].y;

            const intersect = ((yi > point.y) !== (yj > point.y)) &&
                (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);

            if (intersect) inside = !inside;
        }

        return inside;
    }

    /**
     * Get intersections with another path
     * Simplified version - checks line segments
     */
    getIntersections(path: Path): PathLocation[] {
        const intersections: PathLocation[] = [];

        // Check each segment of this path against each segment of the other path
        for (let i = 0; i < this.points.length - 1; i++) {
            const p1 = new Point(this.points[i].x, this.points[i].y);
            const p2 = new Point(this.points[i + 1].x, this.points[i + 1].y);

            for (let j = 0; j < path.points.length - 1; j++) {
                const p3 = new Point(path.points[j].x, path.points[j].y);
                const p4 = new Point(path.points[j + 1].x, path.points[j + 1].y);

                const intersection = this.lineIntersection(p1, p2, p3, p4);
                if (intersection) {
                    const offset = this.points[i].offset +
                        p1.getDistance(intersection) / p1.getDistance(p2) *
                        (this.points[i + 1].offset - this.points[i].offset);

                    intersections.push(this.getLocationAt(offset));
                }
            }
        }

        return intersections;
    }

    /**
     * Helper: Line segment intersection
     */
    private lineIntersection(p1: Point, p2: Point, p3: Point, p4: Point): Point | null {
        const x1 = p1.x, y1 = p1.y;
        const x2 = p2.x, y2 = p2.y;
        const x3 = p3.x, y3 = p3.y;
        const x4 = p4.x, y4 = p4.y;

        const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

        if (Math.abs(denom) < 0.0001) return null; // Parallel lines

        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
        const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return new Point(
                x1 + t * (x2 - x1),
                y1 + t * (y2 - y1)
            );
        }

        return null;
    }

    /**
     * Get interpolated path data at any offset
     */
    private getPathDataAt(offset: number): PathPointData {
        // Normalize offset for closed paths
        let normalizedOffset = offset;
        if (this.closed) {
            normalizedOffset = offset % this.length;
            if (normalizedOffset < 0) normalizedOffset += this.length;
        } else {
            normalizedOffset = Math.max(0, Math.min(offset, this.length));
        }

        // Find the two points to interpolate between
        const exactIndex = (normalizedOffset / this.length) * (this.points.length - 1);
        const index = Math.floor(exactIndex);
        const nextIndex = Math.min(index + 1, this.points.length - 1);
        const t = exactIndex - index;

        const p1 = this.points[index];
        const p2 = this.points[nextIndex];

        // Interpolate all values
        return {
            x: this.lerp(p1.x, p2.x, t),
            y: this.lerp(p1.y, p2.y, t),
            angle: this.lerpAngle(p1.angle, p2.angle, t),
            tangent: {
                x: this.lerp(p1.tangent.x, p2.tangent.x, t),
                y: this.lerp(p1.tangent.y, p2.tangent.y, t),
                angle: this.lerpAngle(p1.tangent.angle, p2.tangent.angle, t),
                length: this.lerp(p1.tangent.length, p2.tangent.length, t)
            },
            normal: {
                x: this.lerp(p1.normal.x, p2.normal.x, t),
                y: this.lerp(p1.normal.y, p2.normal.y, t),
                angle: this.lerpAngle(p1.normal.angle, p2.normal.angle, t),
                length: this.lerp(p1.normal.length, p2.normal.length, t)
            },
            offset: normalizedOffset
        };
    }

    private lerp(a: number, b: number, t: number): number {
        return a + (b - a) * t;
    }

    private lerpAngle(a: number, b: number, t: number): number {
        let diff = b - a;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        return a + diff * t;
    }

    /**
     * Get all points as an array
     */
    getAllPoints(): Point[] {
        return this.points.map(p => new Point(p.x, p.y));
    }

    /**
     * Get number of sample points
     */
    getPointCount(): number {
        return this.points.length;
    }

    /**
     * Clone this path
     */
    clone(): Path {
        return new Path({
            points: JSON.parse(JSON.stringify(this.points)),
            length: this.length,
            name: 'cloned',
            closed: this.closed,
            bounds: { ...this.bounds }
        });
    }
}

/**
 * PathLocation - represents a location on a path
 * Similar to Paper.js CurveLocation
 */
export class PathLocation {
    constructor(
        public point: Point,
        public tangent: Point,
        public normal: Point,
        public angle: number,
        public offset: number,
        public path: Path
    ) {}

    /**
     * Get distance from this location to another point
     */
    getDistance(point: Point): number {
        return this.point.getDistance(point);
    }
}
