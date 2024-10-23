import {io} from "socket.io-client";

const App = () => {
    return {
        driversCount: null as number | null,

        init() {
            const socket = io("/visitors", { transports: ["websocket"] });
            socket.on('driver-count-update', (count) => this.setCount(count));
        },

        setCount(count: number) {
            this.driversCount = count;
        },
    }
}

export default App;
