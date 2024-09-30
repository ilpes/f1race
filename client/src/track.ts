import {Layer, Item, Path} from "paper";


export class Track
{
    private path: Path;

    constructor(svg: SVGElement) {
        const layer = new Layer();

        layer.importSVG(svg, (item: Item) => {
            item.strokeColor = '#252525';
            item.strokeWidth = 8;

            this.path = item.children['circuit'];
        });
    }

    getPath(): Path {
        return this.path;
    }
}
