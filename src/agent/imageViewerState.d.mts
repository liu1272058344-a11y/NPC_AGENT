export interface ViewportState { zoom: number; x: number; y: number }
export function clampZoom(value: number): number
export function resetViewport(): ViewportState
export function zoomAroundPoint(state: ViewportState, nextZoom: number, point: { x: number; y: number }): ViewportState
export function panWithinBounds(state: ViewportState, viewport: { width: number; height: number }): ViewportState
export function keyboardViewerCommand(key: string): 'close' | 'zoom-in' | 'zoom-out' | 'reset' | null
