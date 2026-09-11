import './radaiDialog.css'

let queue = Promise.resolve()

function openDialog(kind, message, defaultValue = '') {
  const show = () => new Promise((resolve) => {
    const previousFocus = document.activeElement
    const dialog = document.createElement('dialog')
    dialog.className = 'radai-dialog'
    const title = kind === 'alert' ? 'Notification' : kind === 'prompt' ? 'Enter details' : 'Confirm action'
    // Message and input values are assigned as text, never interpreted as HTML.
    dialog.innerHTML = `<form><header><span class="radai-dialog-icon" aria-hidden="true">&#10003;</span><h2></h2><button type="button" class="radai-dialog-close" aria-label="Close dialog">&times;</button></header><section><p></p></section><footer></footer></form>`
    const heading = dialog.querySelector('h2')
    heading.id = 'radai-dialog-title'
    heading.textContent = title
    dialog.setAttribute('aria-labelledby', heading.id)
    const text = dialog.querySelector('p')
    text.id = 'radai-dialog-message'
    text.textContent = String(message ?? '')
    dialog.setAttribute('aria-describedby', text.id)
    let input
    if (kind === 'prompt') {
      input = document.createElement('textarea')
      input.rows = 3
      input.value = String(defaultValue ?? '')
      input.setAttribute('aria-labelledby', text.id)
      dialog.querySelector('section').append(input)
    }
    const finish = (accepted) => {
      dialog.close()
      dialog.remove()
      previousFocus?.focus()
      resolve(kind === 'prompt' ? (accepted ? input.value : null) : kind === 'confirm' ? accepted : undefined)
    }
    const footer = dialog.querySelector('footer')
    if (kind !== 'alert') {
      const cancel = document.createElement('button')
      cancel.type = 'button'
      cancel.textContent = 'Cancel'
      cancel.onclick = () => finish(false)
      footer.append(cancel)
    }
    const confirm = document.createElement('button')
    confirm.type = 'submit'
    confirm.className = 'radai-dialog-primary'
    confirm.textContent = kind === 'alert' ? 'OK' : 'Confirm'
    footer.append(confirm)
    dialog.querySelector('form').onsubmit = (event) => { event.preventDefault(); finish(true) }
    dialog.querySelector('.radai-dialog-close').onclick = () => finish(false)
    dialog.oncancel = (event) => { event.preventDefault(); finish(false) }
    document.body.append(dialog)
    dialog.addEventListener('keydown', (event) => event.stopPropagation())
    dialog.showModal()
    ;(input || footer.querySelector('button')).focus()
  })
  const result = queue.then(show)
  queue = result.catch(() => {})
  return result
}

export const radaiConfirm = (message) => openDialog('confirm', message)
export const radaiPrompt = (message, defaultValue) => openDialog('prompt', message, defaultValue)
export const radaiAlert = (message) => openDialog('alert', message)
