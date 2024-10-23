import {io, Socket} from "socket.io-client";
import {DriverData, DriverPosition, RaceStatus} from "../types.ts";
import * as paper from "paper";
import {Game} from "./game/Game.ts";

type AppInterface = {
    game: Game,
    raceId:string,
    position:number,
    socket:Socket,
    init: Function,
    initGame: Function,
    initSocket: Function,
    onUpdate: Function,
    onFinish: Function,
    onInitialize: Function,
    onDriverUpdate: Function,
    onDriverConnected: Function,
    onDriverDisconnected: Function,
    onStarting: Function,
    onStart: Function,
    onFinished: Function,
}

const App = ()  => <AppInterface>({
        raceId: null,
        position: null,
        socket: null,
        game: null,

        init() {
            // Get race id and position from the URL
            const raceIdAndPosition = window.location.pathname.replace('/races/', '');
            const lastIndex = raceIdAndPosition.lastIndexOf('-');
            const raceId = raceIdAndPosition.slice(0, lastIndex);
            const position = parseInt(raceIdAndPosition.slice(lastIndex + 1));

            console.log(`Initialize race #${raceId} for driver #${position}`);

            this.initSocket(raceId, position);
            this.initGame(raceId, position);
        },

        onFinish() {
           this.socket.emit('finish');
        },

        onUpdate(data: DriverPosition) {
            this.socket.emit('update', data);
        },

        initGame(raceId: string, position: number) {
            // @ts-ignore
            const container : HTMLElement = this.$refs.container;

            // @ts-ignore
            const canvas= this.$refs.track as HTMLCanvasElement;

            // @ts-ignore
            const trackSvg: SVGElement = this.$refs.monza as SVGElement;

            paper.setup(canvas);

            this.game = new Game({
                raceId: raceId,
                position: position,
                document: document,
                container: container,
                trackSvg: trackSvg,
                onUpdate: (data: DriverPosition) => this.onUpdate(data),
                onFinish: () => this.onFinish(),
            });
        },

        onInitialize(drivers: Array<DriverData>, status: RaceStatus) {
            console.log(`Initialize ${status} game with drivers...`, drivers);
            this.game.initialize(drivers, status);
        },

        onDriverUpdate(data: DriverData) {
            this.game.update(data.position, data.data);
        },

        onDriverConnected(data: DriverData) {
            console.log(`Driver #${data.position} connected!`);
            this.game.driverJoined(data.position, data.data);
        },

        onDriverDisconnected(data: DriverData) {
            console.log(`Driver #${data.position} disconnected!`);
            this.game.driverLeft(data.position);
        },

        onStarting() {
            console.log('Starting...');
        },

        onStart() {
            console.log('Start...');
            this.game.start();
        },

        onFinished(data: DriverData) {
            console.log('Finished...', data);
        },

        initSocket(raceId: string, position: number) {
            this.socket = io("/races", {autoConnect: false});
            this.socket.auth = {raceId, position};
            this.socket.connect();

            this.socket.on('initialize', (drivers: Array<DriverData>, status: RaceStatus) => this.onInitialize(drivers, status));
            this.socket.on('driver-update', (data: DriverData) => this.onDriverUpdate(data));
            this.socket.on('driver-connected', (data: DriverData) => this.onDriverConnected(data));
            this.socket.on('driver-disconnected', (data: DriverData) => this.onDriverDisconnected(data));
            this.socket.on('starting', () => this.onStarting());
            this.socket.on('start', () => this.onStart());
            this.socket.on('finished', (data: DriverData) => this.onFinished(data));
        },
});

export default App;
