import apiClient from './api.service';
const query = filters => new URLSearchParams(Object.entries(filters || {}).filter(([, value]) => value !== '' && value !== null && value !== undefined)).toString();
const goodsReceiptsService = {
  async list(filters = {}) { return (await apiClient.get(`/procurement/receipts/?${query(filters)}`)).data; },
  async summary(filters = {}) { return (await apiClient.get(`/procurement/receipts/inspection-summary/?${query(filters)}`)).data; },
  async retrieve(id) { return (await apiClient.get(`/procurement/receipts/${encodeURIComponent(id)}/`)).data; },
};
export default goodsReceiptsService;
