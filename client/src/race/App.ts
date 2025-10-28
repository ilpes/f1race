import {io, Socket} from "socket.io-client";
import {DriverData, RaceStatus} from "../types.ts";
import * as paper from "paper";
import {Game, GameState, RaceState} from "./game/Game.ts";
import {PathExporter} from "./game/PathExporter.ts";

type AppInterface = {
    game: Game,
    raceId: string,
    position: number,
    socket: Socket,
    init: Function,
    initGame: Function,
    initSocket: Function,
    onDriverConnected: Function,
    onDriverDisconnected: Function,
    onStarting: Function,
    onStart: Function,
    onSpeedUp: Function,
    onBrake: Function,
    onGameState: Function,
    onFinished: Function,
    downloadTrackPath: Function,
}

const App = () => <AppInterface>({
    raceId: null,
    position: null,
    socket: null,
    game: null,

    init() {
        const raceIdAndPosition = window.location.pathname.replace('/races/', '');
        const lastIndex = raceIdAndPosition.lastIndexOf('-');
        const raceId = raceIdAndPosition.slice(0, lastIndex);
        const driverNumber = parseInt(raceIdAndPosition.slice(lastIndex + 1));

        this.initSocket(raceId, driverNumber);
        this.initGame(raceId, driverNumber);
    },

    downloadTrackPath() {

        const trackPath = this.game.getTrackPath();
        const trackData = (new PathExporter()).extract(trackPath, 2000);

        const blob = new Blob([trackData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'track.json';
        a.click();

        URL.revokeObjectURL(url);
    },

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
            onSpeedUp: (driverNumber: number, sequence: number) => this.onSpeedUp(driverNumber, sequence),
            onBrake: (driverNumber: number, sequence: number) => this.onBrake(driverNumber, sequence),
        });

        trackSvg.remove();
    },

    onSpeedUp(driverNumber: number, sequence: number) {
        this.socket.emit('input', {
            driverNumber,
            action: 'speed-up',
            sequence,
            timestamp: Date.now()
        });
    },

    onBrake(driverNumber: number, sequence: number) {
        this.socket.emit('input', {
            driverNumber,
            action: 'brake',
            sequence,
            timestamp: Date.now()
        });
    },

    onDriverDisconnected(driverNumber: number) {
        console.log(`Driver ${driverNumber} got disconnected...`);
        //this.game.driverLeft(driverNumber);
    },

    onDriverConnected(driverNumber: number, state: RaceState) {
        //console.log(`Driver ${driverNumber} joined...`, state);
        this.game.driverJoined(driverNumber, state);
        //this.game.updateGameState(state)
    },

    onGameState(state: GameState) {
        //console.dir(state.drivers['1']?.velocity.toFixed(2), state.drivers['2']?.velocity.toFixed(2));
        this.game.updateGameState(state);
    },

    onStarting() {
        console.log('Starting...');
    },

    onFinished() {
        console.log('Finished...');
    },

    onStart() {
        console.log('Start...');
        this.game.start();
    },

    initSocket(raceId: string, driverNumber: number) {
        //console.log(`Initialize socket for driver #${driverNumber}`);

        this.socket = io("/races", {autoConnect: false, transports: ["websocket"]});
        this.socket.auth = {raceId, position: driverNumber};
        this.socket.connect();

        this.socket.on('connect', () => {
            // @todo: reset reconnection status
            console.log('Connected!');
        })

        this.socket.on('driver-connected', (driverNumber: number, drivers: DriverData[], status: RaceStatus, state: GameState) =>
            this.onDriverConnected(driverNumber, drivers, status, state));
        this.socket.on('driver-disconnected', (driverNumber: number) => this.onDriverDisconnected(driverNumber));

        this.socket.on('game-state', (state: GameState) => this.onGameState(state));
        this.socket.on('starting', () => this.onStarting());
        this.socket.on('start', () => this.onStart());
        this.socket.on('finished', () => this.onFinished());
    },
});

export default App;
