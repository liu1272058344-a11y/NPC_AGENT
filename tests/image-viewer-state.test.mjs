import test from 'node:test'
import assert from 'node:assert/strict'
import { clampZoom, keyboardViewerCommand, panWithinBounds, resetViewport, zoomAroundPoint } from '../src/agent/imageViewerState.mjs'

test('viewer zoom is clamped from one half to five times', () => {
  assert.equal(clampZoom(0.1), 0.5)
  assert.equal(clampZoom(7), 5)
  assert.equal(clampZoom(1.75), 1.75)
})

test('zoom keeps the pointer anchored and reset restores one times', () => {
  assert.deepEqual(zoomAroundPoint({ zoom: 1, x: 0, y: 0 }, 2, { x: 50, y: 25 }), { zoom: 2, x: -50, y: -25 })
  assert.deepEqual(resetViewport(), { zoom: 1, x: 0, y: 0 })
})

test('pan is bounded and keyboard commands are mapped', () => {
  assert.deepEqual(panWithinBounds({ zoom: 2, x: 900, y: -900 }, { width: 400, height: 300 }), { zoom: 2, x: 200, y: -150 })
  assert.equal(keyboardViewerCommand('Escape'), 'close')
  assert.equal(keyboardViewerCommand('+'), 'zoom-in')
  assert.equal(keyboardViewerCommand('0'), 'reset')
})
