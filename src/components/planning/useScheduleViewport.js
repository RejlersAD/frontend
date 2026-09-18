import { useLayoutEffect } from 'react'

/** Fill the visible application pane, keeping both scrollbars and the schedule footer in view. */
export default function useScheduleViewport(ref, tab) {
  useLayoutEffect(() => {
    const canvas = ref.current
    if (!canvas) return undefined
    let frame
    const update = () => {
      const viewport = canvas.querySelector('.p6-viewport')
      if (!viewport) return
      const main = canvas.closest('.main-content')
      const mainBottom = main?.getBoundingClientRect().bottom ?? window.innerHeight
      const viewportBottom = window.visualViewport ? window.visualViewport.offsetTop + window.visualViewport.height : window.innerHeight
      const reserved = ['.p6-scrollbars', '.p6-legend', '.sc-footer'].reduce((sum, selector) => sum + (canvas.querySelector(selector)?.getBoundingClientRect().height || 0), 6)
      const height = Math.max(200, Math.floor(Math.min(mainBottom, viewportBottom) - viewport.getBoundingClientRect().top - reserved))
      canvas.style.setProperty('--p6-viewport-height', `${height}px`)
    }
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update) }
    const observer = new ResizeObserver(schedule)
    const main = canvas.closest('.main-content')
    for (const element of [main, canvas.parentElement, canvas.querySelector('.sc-commandbar'), canvas.querySelector('.sc-footer'), canvas.querySelector('.p6-legend'), canvas.closest('.project-performance-workspace')?.querySelector('.pp-header')]) {
      if (element) observer.observe(element)
    }
    window.addEventListener('resize', schedule)
    window.visualViewport?.addEventListener('resize', schedule)
    update()
    return () => {
      observer.disconnect(); cancelAnimationFrame(frame)
      window.removeEventListener('resize', schedule)
      window.visualViewport?.removeEventListener('resize', schedule)
    }
  }, [ref, tab])
}
