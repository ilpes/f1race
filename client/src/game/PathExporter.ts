import Path = paper.Path;

interface PathPoint {
    x: number;
    y: number;
    angle: number;

    // Additional data for Paper.js compatibility
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

    // Distance from start
    offset: number;
}

interface TrackData {
    points: PathPoint[];
    length: number;
    name: string;

    // Track metadata
    closed: boolean;
    bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}

export class PathExporter {
    /**
     * Extract complete path data from Paper.js including all geometric info
     * @param path - Paper.js Path object
     * @param samples - Number of points to sample (more = more accurate, larger data)
     */
    extract(path: Path, samples: number = 1000): string {
        const points: PathPoint[] = [];

        for (let i = 0; i <= samples; i++) {
            const offset = (i / samples) * path.length;

            // Get point
            const point = path.getPointAt(offset);

            // Get tangent (direction of the path at this point)
            const tangent = path.getTangentAt(offset);

            // Get normal (perpendicular to the path at this point)
            const normal = path.getNormalAt(offset);

            points.push({
                x: point.x,
                y: point.y,
                angle: tangent.angle,

                tangent: {
                    x: tangent.x,
                    y: tangent.y,
                    angle: tangent.angle,
                    length: tangent.length
                },

                normal: {
                    x: normal.x,
                    y: normal.y,
                    angle: normal.angle,
                    length: normal.length
                },

                offset: offset
            });
        }

        return JSON.stringify({
            points: points,
            length: path.length,
            name: 'track',
            closed: path.closed,
            bounds: {
                x: path.bounds.x,
                y: path.bounds.y,
                width: path.bounds.width,
                height: path.bounds.height
            }
        } as TrackData, null, 2);
    }

    // /**
    //  * Export to JSON file
    //  */
    // toJson(trackData: TrackData): string {
    //     return JSON.stringify(trackData, null, 2);
    // }

    /**
     * Download as JSON file
     */
    // static downloadAsJSON(trackData: TrackData, filename: string = 'track-data.json'): void {
    //     const json = this.toJSON(trackData);
    //     const blob = new Blob([json], { type: 'application/json' });
    //     const url = URL.createObjectURL(blob);
    //
    //     const a = document.createElement('a');
    //     a.href = url;
    //     a.download = filename;
    //     a.click();
    //
    //     URL.revokeObjectURL(url);
    // }
    //
    // /**
    //  * Get file size estimate in KB
    //  */
    // static getFileSizeEstimate(trackData: TrackData): number {
    //     const json = this.toJSON(trackData);
    //     return json.length / 1024;
    // }
}
