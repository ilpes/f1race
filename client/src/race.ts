import './style.css';
import {io} from "socket.io-client";
import {Game} from "./game.ts";
import * as paper from "paper";
import {Track} from "./track.ts";
import {Car} from "./car.ts";
import CarImage from "./car.png";

const socket = io("http://localhost:3000");
const raceIdAndPosition = window.location.pathname.replace('/races/', '');
const lastIndex = raceIdAndPosition.lastIndexOf('-');
const raceId = raceIdAndPosition.slice(0, lastIndex);
const position = raceIdAndPosition.slice(lastIndex + 1);
const container : HTMLElement = document.getElementById('container');
const canvas = document.getElementById('track') as HTMLCanvasElement;
const trackSvg: SVGElement = document.getElementById('track-svg') as SVGElement;

paper.setup(canvas);

const track = new Track(trackSvg);
const car: Car = new Car(container, CarImage as string, track.getPath());
const game = new Game(document, car);

socket.emit("joined", {raceId, position}, (data) => console.log(data));
socket.on("joined", (data: {position: string}) => {
    if (position === data.position) {
        return;
    }

    console.log(`Player ${data.position} joined...`)
});



const updateGame = () => {
    game.render();
    requestAnimationFrame(updateGame);
}
requestAnimationFrame(updateGame);
