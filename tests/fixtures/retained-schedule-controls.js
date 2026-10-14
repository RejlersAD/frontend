import { expect } from '@playwright/test'

export const retainedScheduleSettings = page => page.getByRole('dialog', { name: 'Schedule settings', exact: true })

export async function openRetainedScheduleSettings(page) {
  const dialog = retainedScheduleSettings(page)
  if (!await dialog.isVisible()) await page.getByRole('button', { name: 'Schedule settings', exact: true }).click()
  await expect(dialog).toBeVisible()
  return dialog
}

export async function closeRetainedScheduleSettings(page) {
  const dialog = retainedScheduleSettings(page)
  if (await dialog.isVisible()) await dialog.getByRole('button', { name: 'Close schedule settings', exact: true }).click()
  await expect(dialog).toHaveCount(0)
}

export async function expectRetainedScheduleVersion(page, value) {
  const dialog = await openRetainedScheduleSettings(page)
  await expect(dialog.getByRole('combobox', { name: 'Schedule version', exact: true })).toHaveValue(String(value))
  await closeRetainedScheduleSettings(page)
}

export async function selectRetainedScheduleVersion(page, value) {
  const dialog = await openRetainedScheduleSettings(page)
  await dialog.getByRole('combobox', { name: 'Schedule version', exact: true }).selectOption(String(value))
  await expect(dialog).toHaveCount(0)
}

export async function retainedScheduleAction(page, name) {
  const dialog = await openRetainedScheduleSettings(page)
  await dialog.getByRole('button', { name, exact: true }).click()
}
