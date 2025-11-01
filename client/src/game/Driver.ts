import {Layer} from "paper";
import {DriverStatus, DriverType} from "../types.ts"

export class Driver {

    // @ts-ignore
    protected status: DriverStatus;
    protected image: HTMLImageElement;
    protected number: number = 0;
    protected type: DriverType;

    constructor(
        container: HTMLElement,
        image: string,
        number: number,
        type: DriverType,
    ) {
        this.number = number;
        this.type = type;
        this.addLayer();
        this.addImage(container, image);
    }

    private addLayer() {
        new Layer();
    }

    protected addImage(container: HTMLElement, image: string) {
        this.image = new Image()
        this.image.src = image;
        this.image.className = 'car';
        this.image.style.opacity = '.5';

        if (this.type === 'manual') {
            this.image.style.opacity = '1';
        }

        container.append(this.image);
    }

    update(x: string, y: string, rotation: string) {
       this.image.style['transform'] = 'translate3d(' + x + 'px, ' + y + 'px, 0px) rotate(' + rotation + 'deg)';
    }
}
