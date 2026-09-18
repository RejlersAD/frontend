import { orderFormHarness, orderFormRecommendation } from './purchase-order-form.fixture'
import { formActor } from './purchase-recommendation-form.fixture'

export const folderProjects = [
  { id: 'folder-17', scope_id: 'folder-17', source_id: 'source-1', folder_name: '5900985-EPC FOR PE4 & PE5 REVAMP PROJECT', code: '5900985', name: 'EPC for PE4 & PE5 Revamp', project_id: '17', procurement_project_id: '17', can_prepare: true, purchase_order_count: 2 },
  { id: 'folder-18', scope_id: 'folder-18', source_id: 'source-1', folder_name: '5901142-SARB PRODUCED WATER TREATMENT PROJECT', code: '5901142', name: 'SARB Produced Water Treatment', project_id: '18', procurement_project_id: null, can_prepare: true, purchase_order_count: 1 },
  { id: 'folder-new', scope_id: 'folder-new', source_id: 'source-1', folder_name: '5900738 EPCM-Grid Power Integration Project', code: '5900738', name: 'EPCM-Grid Power Integration Project', project_id: null, procurement_project_id: null, can_prepare: true, purchase_order_count: 0 },
  ...Array.from({ length: 51 }, (_, index) => ({ id: `folder-extra-${index}`, scope_id: `folder-extra-${index}`, source_id: 'source-1', folder_name: `${5901200 + index}-Engineering project ${index + 1}`, code: `${5901200 + index}`, name: `Engineering project ${index + 1}`, project_id: null, procurement_project_id: null, can_prepare: true, purchase_order_count: 0 })),
]
export const projectLinkOrders = [
  { id: 'order-1', po_number: 'PO-2026-0048', title: 'Process engineering support', vendor_name: 'Alfanar Engineering LLC', po_date: '2026-09-15', status: 'draft', total_amount: '125000.00', currency: 'AED', current_project: null },
  { id: 'order-2', po_number: 'PO-2026-0049', title: 'Specialist design review', vendor_name: 'Petroserve Solutions', po_date: '2026-09-16', status: 'completed', total_amount: '28750.00', currency: 'USD', current_project: { id: '18', code: '5901142', name: 'SARB Produced Water Treatment' } },
  { id: 'order-3', po_number: 'PO-2026-0050', title: 'Site survey and field assessment', vendor_name: 'Desert Tech Services', po_date: '2026-09-17', status: 'sent', total_amount: '45200.00', currency: 'AED', current_project: { id: '17', code: '5900985', name: 'EPC for PE4 & PE5 Revamp' } },
  ...Array.from({ length: 15 }, (_, index) => ({ id: `order-extra-${index}`, po_number: `PO-2026-${String(60 + index).padStart(4, '0')}`, title: `Engineering package ${index + 1}`, vendor_name: 'Alfanar Engineering LLC', po_date: '2026-09-14', status: 'draft', total_amount: '12000.00', currency: 'AED', current_project: null })),
]
const reply = (route, data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })

export async function projectLinksHarness(page, options = {}) {
  return orderFormHarness(page, {
    path: '/procurement/projects/reconciliation',
    actor: { ...formActor, modules: [...formActor.modules, { code: 'procurement' }], module_actions: { ...formActor.module_actions, procurement: ['read', 'create', 'update'] } },
    prepare: state => {
      Object.assign(state, { folderProjects: structuredClone(folderProjects), linkOrders: structuredClone(projectLinkOrders), workspaceQueries: [], connections: [], preparations: [], workspaceError: null, connectError: null, prepareError: null, permissions: { can_connect: true, can_create_po: true }, holdWorkspace: null })
      state.recommendation = { ...orderFormRecommendation, enterprise_project: '17' }
      options.prepare?.(state)
    },
    handleRequest: async (route, state, url) => {
      const path = url.pathname, method = route.request().method()
      if (path.endsWith('/projects/link-workspace/')) {
        const query = Object.fromEntries(url.searchParams)
        state.workspaceQueries.push(query)
        if (state.holdWorkspace) await state.holdWorkspace
        if (state.workspaceError) { await reply(route, state.workspaceError.body || { detail: state.workspaceError.message }, state.workspaceError.status || 503); return true }
        if (state.record && !state.linkOrders.some(order => order.id === state.record.id)) {
          const assigned = state.folderProjects.find(folder => String(folder.project_id) === String(state.record.enterprise_project))
          state.linkOrders.unshift({ ...state.record, current_project: assigned ? { id: assigned.project_id, code: assigned.code, name: assigned.name } : null })
        }
        const project = state.folderProjects.find(item => item.scope_id === query.scope_id)
        let rows = state.linkOrders.filter(order => (query.link_status !== 'unlinked' || !order.current_project) && (query.link_status !== 'linked' || order.current_project))
        if (query.scope_id) rows = rows.filter(order => project?.project_id && String(order.current_project?.id) === String(project.project_id))
        const search = (query.search || '').toLowerCase()
        rows = rows.filter(order => `${order.po_number} ${order.title} ${order.vendor_name} ${order.current_project?.code || ''}`.toLowerCase().includes(search))
        const page = Number(query.page || 1), size = Number(query.page_size || 15)
        await reply(route, { projects: state.folderProjects.map(folder => ({ ...folder, purchase_order_count: folder.project_id ? state.linkOrders.filter(order => String(order.current_project?.id) === String(folder.project_id)).length : 0 })), permissions: state.permissions, purchase_orders: { count: rows.length, page, page_size: size, total_pages: Math.max(1, Math.ceil(rows.length / size)), results: rows.slice((page - 1) * size, page * size) } })
        return true
      }
      if (path.endsWith('/projects/connect-folder-order/') && method === 'POST') {
        const body = route.request().postDataJSON(); state.connections.push(body)
        if (state.connectError) { await reply(route, state.connectError.body, state.connectError.status || 400); return true }
        const folder = state.folderProjects.find(item => item.scope_id === body.scope_id), order = state.linkOrders.find(item => item.id === body.order_id)
        if (!folder.project_id) folder.project_id = 'new-canonical-19'
        order.current_project = { id: folder.project_id, code: folder.code, name: folder.name }
        await reply(route, { changed: true, propagated: 0, record_type: 'purchase_order', record_id: order.id, enterprise_project: order.current_project })
        return true
      }
      if (path.endsWith('/projects/prepare-folder-project/') && method === 'POST') {
        const body = route.request().postDataJSON(); state.preparations.push(body)
        if (state.prepareError) { await reply(route, state.prepareError.body, state.prepareError.status || 400); return true }
        const folder = state.folderProjects.find(item => item.scope_id === body.scope_id)
        if (!folder.project_id) folder.project_id = 'new-canonical-19'
        await reply(route, { id: folder.project_id, code: folder.code, name: folder.name, procurement_project_id: folder.procurement_project_id })
        return true
      }
      return false
    },
  })
}
