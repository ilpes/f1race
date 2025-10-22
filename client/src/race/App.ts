import {io, Socket} from "socket.io-client";
import {DriverData, RaceStatus} from "../types.ts";
import * as paper from "paper";
import {Game} from "./game/Game.ts";
import {PathExporter} from "./game/PathExporter.ts";

type AppInterface = {
    game: Game,
    raceId: string,
    position: number,
    socket: Socket,
    init: Function,
    initGame: Function,
    initSocket: Function,
    //onUpdate: Function,
    //onFinish: Function,
    //onInitialize: Function,
    //onDriverUpdate: Function,
    onDriverConnected: Function,
    //onDriverDisconnected: Function,
    onStarting: Function,
    onStart: Function,
    onSpeedUp: Function,
    onBrake: Function,
    onDriverSpeedUp: Function,
    onDriverBrake: Function,
    //onFinished: Function,
}

const App = () => <AppInterface>({
    raceId: null,
    position: null,
    socket: null,
    game: null,

    downloadTrackPath() {
        const trackPath = (new PathExporter()).extract(this.game?.getTrackPath(), 2000);
        const blob = new Blob([trackPath], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'track.json';
        a.click();
        URL.revokeObjectURL(url);
    },

    init() {
        // Get race id and position from the URL
        const raceIdAndPosition = window.location.pathname.replace('/races/', '');
        const lastIndex = raceIdAndPosition.lastIndexOf('-');
        const raceId = raceIdAndPosition.slice(0, lastIndex);
        const driverNumber = parseInt(raceIdAndPosition.slice(lastIndex + 1));

        console.log(`Initialize race #${raceId} for driver #${driverNumber}`);

        this.initSocket(raceId, driverNumber);
        this.initGame(raceId, driverNumber);
    },

    // onFinish() {
    //    this.socket.emit('finish');
    // },

    // onUpdate(data: DriverPosition) {
    //     this.socket.emit('update', data);
    // },

    initGame(raceId: string, driverNumber: number) {
        // @ts-ignore
        const container: HTMLElement = this.$refs.container;

        // @ts-ignore
        const canvas = this.$refs.track as HTMLCanvasElement;

        // @ts-ignore
        const trackSvg: SVGElement = this.$refs.monza as SVGElement;

        paper.setup(canvas);

        this.game = new Game({
            raceId: raceId,
            driverNumber: driverNumber,
            document: document,
            container: container,
            trackSvg: trackSvg,
            onSpeedUp: (driverNumber: number) => this.onSpeedUp(driverNumber),
            onBrake: (driverNumber: number) => this.onBrake(driverNumber),
            // onUpdate: (data: DriverPosition) => this.onUpdate(data),
            //onFinish: () => this.onFinish(),
        });
    },

    onSpeedUp(driverNumber: number) {
        this.socket.emit('speed-up', driverNumber);
    },

    onBrake(driverNumber: number) {
        this.socket.emit('brake', driverNumber);
    },

    // onInitialize(drivers: Array<DriverData>, status: RaceStatus) {
    //     console.log(`Initialize ${status} game with drivers...`, drivers);
    //     this.game.initialize(drivers, status);
    // },

    // onDriverUpdate(data: DriverData) {
    //     console.log(data);
    //     //this.game.update(data.position, data.data);
    // },

    onDriverConnected(driverNumber: number, drivers: Array<DriverData>, status: RaceStatus) {
       // console.log(`Driver connected: ${driverNumber}`, `Race status: ${status}`, `Drivers `, drivers);
        //console.log(`Driver #${data.position} connected!`);
        this.game.driverJoined(driverNumber, drivers, status);
    },

    // onDriverDisconnected(data: DriverData) {
    //     //console.log(`Driver #${data.position} disconnected!`);
    //     //this.game.driverLeft(data.position);
    // },

    onDriverSpeedUp(driverNumber: number) {
        console.log(`Driver ${driverNumber} sped up...`);
        this.game.driverSpedUp(driverNumber);
    },

    onDriverBrake(driverNumber: number) {
        console.log(`Driver ${driverNumber} braked...`);
        this.game.driverBraked(driverNumber);
    },

    onStarting() {
        console.log('Starting...');
    },

    onStart() {
        //console.log('Start...');
        //this.game.start();
    },

    // onFinished(data: DriverData) {
    //     console.log('Finished...', data);
    // },

    initSocket(raceId: string, driverNumber: number) {
        console.log(`Initialize socket for driver #${driverNumber}`);

        this.socket = io("/races", {autoConnect: false, transports: ["websocket"]});
        this.socket.auth = {raceId, position: driverNumber};
        this.socket.connect();

        // this.socket.on('initialize', (drivers: Array<DriverData>, status: RaceStatus) => this.onInitialize(drivers, status));
        // this.socket.on('driver-update', (data: DriverData) => this.onDriverUpdate(data));
        this.socket.on('driver-connected', (driverNumber: number, drivers: DriverData[], status: RaceStatus) => this.onDriverConnected(driverNumber, drivers, status));
        this.socket.on('driver-sped-up', (driverNumber: number) => this.onDriverSpeedUp(driverNumber));
        this.socket.on('driver-braked', (driverNumber: number) => this.onDriverBrake(driverNumber));
        this.socket.on('starting', () => this.onStarting());
        this.socket.on('start', () => this.onStart());
        // this.socket.on('finished', (data: DriverData) => this.onFinished(data));
    },
});

export default App;
