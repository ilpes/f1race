export type DriverPosition = {
    x: number,
    y: number,
    rotation: number,
    distance: number,
    laps: number,
};

export type DriverStatus = 'connected' | 'disconnected';

export type DriverData = {
    position: number,
    status: DriverStatus,
    data: DriverPosition | null,
    result: DriverResult | null,
};

export type OnDriverPositionUpdate = (data: DriverPosition) => void;
export type OnLapCompleted = (lap: number) => void;
export type MouseEventFunction = (this: HTMLElement, ev: MouseEvent) => void;

export type RaceStatus = 'waiting' | 'starting' | 'started' | 'finished';

export type DriverResult = {
    position: number,
    time: number,
}
