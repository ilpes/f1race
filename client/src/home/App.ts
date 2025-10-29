import {io} from "socket.io-client";

const App = () => {
    return {
        driversCount: null as number | null,

        init() {
            const socket = io("/visitors", { transports: ["websocket"] });
            this.driversCount = 7;
            socket.on('driver-count-update', (count) => this.setCount(count));
        },

        setCount(count: number) {
            this.driversCount = 7 + count;
        },
    }
}

export default App;
