export const clampZoom = (value) => Math.min(5, Math.max(0.5, Math.round(value * 100) / 100))
export const resetViewport = () => ({ zoom: 1, x: 0, y: 0 })
export const zoomAroundPoint = (state, nextZoom, point) => {
  const zoom = clampZoom(nextZoom)
  const ratio = zoom / state.zoom
  return { zoom, x: point.x - (point.x - state.x) * ratio, y: point.y - (point.y - state.y) * ratio }
}
export const panWithinBounds = (state, viewport) => {
  const maxX = Math.max(0, viewport.width * (state.zoom - 1) / 2)
  const maxY = Math.max(0, viewport.height * (state.zoom - 1) / 2)
  return { ...state, x: Math.min(maxX, Math.max(-maxX, state.x)), y: Math.min(maxY, Math.max(-maxY, state.y)) }
}
export const keyboardViewerCommand = (key) => key === 'Escape' ? 'close' : ['+', '='].includes(key) ? 'zoom-in' : key === '-' ? 'zoom-out' : key === '0' ? 'reset' : null
