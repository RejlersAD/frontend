import { useLayoutEffect, useRef, useState } from 'react'
import PurchaseOrderLivePreview from '../../pages/Procurement/PurchaseOrderLivePreview'

const DOCUMENT_WIDTH = 560

/** Fit the saved PO's existing paper layout without changing its pagination. */
export default function NotificationPurchaseOrderPreview(props) {
  const viewportRef = useRef(null)
  const documentRef = useRef(null)
  const [size, setSize] = useState({ width: DOCUMENT_WIDTH, height: 0 })

  useLayoutEffect(() => {
    let frame
    const measure = () => {
      const width = viewportRef.current?.clientWidth || DOCUMENT_WIDTH
      const height = documentRef.current?.offsetHeight || 0
      setSize(previous => previous.width === width && previous.height === height ? previous : { width, height })
    }
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    })
    observer.observe(viewportRef.current)
    observer.observe(documentRef.current)
    measure()
    return () => { observer.disconnect(); cancelAnimationFrame(frame) }
  }, [])

  const scale = size.width / DOCUMENT_WIDTH
  return (
    <div ref={viewportRef} className="notification-po-preview">
      <div className="notification-po-preview__frame" style={{ width: size.width, height: size.height * scale }}>
        <div ref={documentRef} className="notification-po-preview__document" style={{ width: DOCUMENT_WIDTH, transform: `scale(${scale})` }}>
          <PurchaseOrderLivePreview {...props} documentOnly />
        </div>
      </div>
    </div>
  )
}
