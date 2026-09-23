export const scheduleWorkspace = page => page.getByRole('region', { name: 'Master schedule workspace', exact: true })

export async function scheduleMenu(page, name) {
  const summary = scheduleWorkspace(page).getByLabel(name, { exact: true })
  if (!await summary.evaluate(element => element.parentElement.open)) await summary.click()
  return summary.locator('..')
}
export async function closeScheduleMenu(page, name) {
  const summary = scheduleWorkspace(page).getByLabel(name, { exact: true })
  if (await summary.evaluate(element => element.parentElement.open)) {
    await summary.focus()
    await page.keyboard.press('Escape')
  }
}
export async function scheduleAction(page, name) {
  await (await scheduleActionButton(page, name)).click()
}
export async function scheduleActionButton(page, name) {
  const menu = await scheduleMenu(page, 'Schedule actions')
  return menu.getByRole('button', { name, exact: true })
}
export async function scheduleVersion(page, value) {
  const menu = await scheduleMenu(page, 'Schedule actions')
  await menu.getByRole('combobox', { name: 'Schedule version', exact: true }).selectOption(value)
  await closeScheduleMenu(page, 'Schedule actions')
}
export async function scheduleDiscipline(page, value) {
  const menu = await scheduleMenu(page, 'Schedule filters')
  await menu.getByRole('combobox', { name: 'Schedule discipline', exact: true }).selectOption(value)
  await closeScheduleMenu(page, 'Schedule filters')
}
export async function scheduleCritical(page, checked) {
  await scheduleWorkspace(page).getByRole('checkbox', { name: 'Critical only', exact: true }).setChecked(checked)
}
export const scheduleArea = (page, value) => scheduleWorkspace(page).getByRole('combobox', { name: 'Schedule workspace area', exact: true }).selectOption(value)
export const timelineScale = (page, value) => scheduleWorkspace(page).getByRole('combobox', { name: 'Timeline scale', exact: true }).selectOption(value.toLowerCase())
