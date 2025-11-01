import {io, Socket} from "socket.io-client";
import * as paper from "paper";
import {Game} from "../game/Game.ts";
import {PathExporter} from "../game/PathExporter.ts";
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import {RaceStatus, GameState, RaceState, RaceResult, ReadableResult} from "../types.ts";

type AppInterface = {
    game: Game,
    raceId: string,
    socket: Socket,
    status: RaceStatus | null,
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
    currentTime: number,
    currentLap: number,
    laps: number,
    setCurrentLap: Function,
    clock: number | null,
    startTimerAt: Function,
    readableTime : string,
    setReadableTime: Function,
    go: boolean,
    result: ReadableResult | null,
    formatTime: Function,
}

const App = (): AppInterface => ({
    raceId: null,
    socket: null,
    game: null,
    status: null,
    currentTime: 0,
    currentLap: 0,
    laps: 0,
    clock: null,
    readableTime: '00:00:00',
    go: true,
    result: null,

    init() {
        const raceId = window.location.pathname.replace('/warmups/', '');
        this.initSocket(raceId);
        this.initGame(raceId);

        dayjs.extend(duration);
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

    initGame(raceId: string) {
        // @ts-ignore
        const container: HTMLElement = this.$refs.container;
        // @ts-ignore
        const canvas = this.$refs.track as HTMLCanvasElement;
        // @ts-ignore
        const trackSvg: SVGElement = this.$refs.monza as SVGElement;

        paper.setup(canvas);

        this.game = new Game({
            raceId: raceId,
            driverNumber: 1,
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

    onDriverDisconnected() {
        console.log(`Driver got disconnected...`);
    },

    onDriverConnected(state: RaceState) {
        console.log(`Driver connected with state: ${JSON.stringify(state)}`);
        this.status = state.status;
        this.game.driverJoined(1, state);

        this.laps = state.laps;
        this.setCurrentLap(state.state)

        if (state.status === 'started') {
            this.startTimerAt(state.state.serverTime - state.startedAt);
            setTimeout(() => {
                this.go = false;
            }, 3000);
        }
    },

    setCurrentLap(state: GameState) {
        for (const driverNum in state.drivers) {
            if (Number(driverNum) !== this.game.getDriverNumber()) {
                continue;
            }
            const driver = state.drivers[driverNum];
            this.currentLap = Math.min(driver.laps + 1, this.laps);
        }
    },

    onGameState(state: GameState) {
        this.setCurrentLap(state);
        this.game.updateGameState(state);
    },

    onStarting() {
        console.log(`Starting...`);
        this.status = 'starting';
    },

    onFinished(result: RaceResult) {
        console.log(`Finished...`, result);
        this.status = 'finished';

        if (this.clock) {
            clearInterval(this.clock);
        }

        setTimeout(() => {
            const res = result[String(this.game.getDriverNumber())];
            this.result = {
                position: res.position,
                time: this.formatTime(res.time),
                distance: res.distance === null ? null : '+ ' + this.formatTime(res.distance),
            }
        }, 1000);
    },

    startTimerAt(startAt: number) {
        this.currentTime = startAt;
        this.clock = setInterval(() => {
            this.currentTime += 53;
            this.setReadableTime();
        }, 53)
    },

    setReadableTime() {
        this.readableTime = this.formatTime(this.currentTime);
    },

    formatTime(time: number) {
        const d = dayjs.duration(time);
        const minutes = String(Math.floor(d.asMinutes())).padStart(2, '0');
        const seconds = String(d.seconds()).padStart(2, '0');
        const milliseconds = String(d.milliseconds()).padStart(3, '0');

        return `${minutes}:${seconds}.${milliseconds}`;
    },

    onStart() {
        console.log(`Started...`);
        this.status = 'started';
        this.game.start();
        this.startTimerAt(0);

        setTimeout(() => {
            this.go = false;
        }, 3000);
    },

    initSocket(warmupId: string) {
        this.socket = io("/warmups", {autoConnect: false, transports: ["websocket"]});
        this.socket.auth = {warmupId};
        this.socket.connect();

        this.socket.on('driver-connected', (state: RaceState) =>
            this.onDriverConnected(state));
        this.socket.on('driver-disconnected', () => this.onDriverDisconnected());

        this.socket.on('game-state', (state: GameState) => this.onGameState(state));
        this.socket.on('starting', () => this.onStarting());
        this.socket.on('start', () => this.onStart());
        this.socket.on('finished', (result: RaceResult) => this.onFinished(result));
    },
});

export default App;
