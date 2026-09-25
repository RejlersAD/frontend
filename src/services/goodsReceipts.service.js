import apiClient from './api.service';
const query = filters => new URLSearchParams(Object.entries(filters || {}).filter(([, value]) => value !== '' && value !== null && value !== undefined)).toString();
const goodsReceiptsService = {
  async availableOrders(filters = {}) { return (await apiClient.get(`/procurement/receipts/available-orders/?${query(filters)}`)).data; },
  async receivingSummary(id) { return (await apiClient.get(`/procurement/orders/${encodeURIComponent(id)}/receiving-summary/`)).data; },
  async create(payload, reconcile = false) { return (await apiClient.post(`/procurement/receipts/${reconcile ? 'reconcile/' : ''}`, payload)).data; },
  async list(filters = {}) { return (await apiClient.get(`/procurement/receipts/?${query(filters)}`)).data; },
  async summary(filters = {}) { return (await apiClient.get(`/procurement/receipts/inspection-summary/?${query(filters)}`)).data; },
  async retrieve(id) { return (await apiClient.get(`/procurement/receipts/${encodeURIComponent(id)}/`)).data; },
  async confirmDelivery(id, payload) { return (await apiClient.post(`/procurement/receipts/${encodeURIComponent(id)}/confirm_delivery/`, payload)).data; },
  async remove(id, payload) {
    const response = await apiClient.delete(`/procurement/receipts/${encodeURIComponent(id)}/`, { data: payload });
    if (response.status !== 204) throw new Error('Receipt deletion could not be verified. Refresh the receipt details.');
  },
};
export default goodsReceiptsService;
