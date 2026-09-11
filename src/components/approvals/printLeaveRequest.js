// Print an isolated copy so navigation and other employees never enter the document.
export async function printLeaveRequest(panel) {
  const frame = document.createElement('iframe')
  frame.title = 'Selected leave request print document'
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:1000px;height:800px;border:0'
  document.body.appendChild(frame)
  const cleanup = () => frame.remove()
  try {
    const doc = frame.contentDocument
    doc.open()
    doc.write('<!doctype html><html><head><title>Approved leave request</title></head><body></body></html>')
    doc.close()
    const styles = [...document.querySelectorAll('style, link[rel="stylesheet"]')].map(source => {
      const copy = source.cloneNode(true)
      const ready = source.tagName === 'LINK' ? new Promise((resolve, reject) => {
        copy.onload = resolve
        copy.onerror = () => reject(new Error('Print styles could not be loaded. Please try again.'))
      }) : Promise.resolve()
      doc.head.appendChild(copy)
      return ready
    })
    const copy = panel.cloneNode(true)
    copy.querySelectorAll('button, footer, [role="alert"]').forEach(node => node.remove())
    copy.querySelectorAll('*').forEach(node => node.removeAttribute('id'))
    const wrapper = doc.createElement('main')
    while (copy.firstChild) wrapper.appendChild(copy.firstChild)
    doc.body.appendChild(wrapper)
    const style = doc.createElement('style')
    style.textContent = '@page { size: A4; margin: 12mm; } body { margin:0; color:#0f172a; font-family:Arial,sans-serif; } main { width:100%; } * { print-color-adjust:exact; -webkit-print-color-adjust:exact; } section, aside, li { break-inside:avoid; } .overflow-y-auto { overflow:visible!important; max-height:none!important; }'
    doc.head.appendChild(style)
    await Promise.all(styles)
    await doc.fonts.ready
    await Promise.all([...doc.images].map(image => image.decode().catch(() => {})))
    frame.contentWindow.addEventListener('afterprint', cleanup, { once: true })
    frame.contentWindow.focus()
    frame.contentWindow.print()
    // Fallback for browsers that omit afterprint on cancellation.
    setTimeout(cleanup, 300000)
  } catch (error) {
    cleanup()
    throw error
  }
}
