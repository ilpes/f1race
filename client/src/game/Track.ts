// @ts-ignore
import {Layer, Path, Item} from "paper";

export class Track
{
    // @ts-ignore
    private path: Path;

    constructor(svg: SVGElement) {
        const layer = new Layer();

        // @ts-ignore
        layer.importSVG(svg, (item: Item) => {
            item.strokeColor = '#252525' as any;
            item.strokeWidth = 8;

            this.path = item.children['circuit'];
        });
    }

    // @ts-ignore
    getPath(): Path {
        return this.path;
    }
}
