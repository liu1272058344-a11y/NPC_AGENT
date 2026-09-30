import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react'
import { keyboardViewerCommand, panWithinBounds, resetViewport, zoomAroundPoint } from '../agent/imageViewerState.mjs'

interface ViewerImage { url: string; alt: string; meta?: string }
export function ImageViewer({ image, downloadUrl, onClose }: { image: ViewerImage; downloadUrl: string; onClose: () => void }) {
  const [view, setView] = useState(resetViewport)
  const drag = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null)
  const stage = useRef<HTMLDivElement>(null)
  const adjust = (factor: number) => setView((current) => zoomAroundPoint(current, current.zoom * factor, { x: 0, y: 0 }))
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => { const command = keyboardViewerCommand(event.key); if (!command) return; event.preventDefault(); if (command === 'close') onClose(); else if (command === 'reset') setView(resetViewport()); else adjust(command === 'zoom-in' ? 1.2 : 1 / 1.2) }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  })
  const wheel = (event: ReactWheelEvent) => { event.preventDefault(); const rect = stage.current?.getBoundingClientRect(); const point = rect ? { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 } : { x: 0, y: 0 }; setView((current) => zoomAroundPoint(current, current.zoom * (event.deltaY < 0 ? 1.15 : 1 / 1.15), point)) }
  const pointerDown = (event: ReactPointerEvent) => { drag.current = { x: event.clientX, y: event.clientY, startX: view.x, startY: view.y }; event.currentTarget.setPointerCapture(event.pointerId) }
  const pointerMove = (event: ReactPointerEvent) => { if (!drag.current || !stage.current) return; const rect = stage.current.getBoundingClientRect(); setView(panWithinBounds({ ...view, x: drag.current.startX + event.clientX - drag.current.x, y: drag.current.startY + event.clientY - drag.current.y }, rect)) }
  return <div className="image-viewer" role="dialog" aria-modal="true" aria-label="图片查看器"><div className="viewer-toolbar"><span>{image.meta}</span><button onClick={() => adjust(1 / 1.2)} aria-label="缩小">−</button><strong>{Math.round(view.zoom * 100)}%</strong><button onClick={() => adjust(1.2)} aria-label="放大">＋</button><button onClick={() => setView(resetViewport())}>重置</button><a href={downloadUrl} download>下载原图</a><button onClick={onClose} aria-label="关闭图片查看器">关闭</button></div><div ref={stage} className="viewer-stage" onWheel={wheel} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={() => { drag.current = null }}><img src={image.url} alt={image.alt} draggable={false} style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }} /></div></div>
}
