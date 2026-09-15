import apiClient from './api.service';

const BASE_URL = '/rbac/admin/database/tables/';

export default {
  async getTables() {
    return (await apiClient.get(BASE_URL, { suppressErrorToast: true })).data;
  },

  async performAction({ table, action, confirmation }) {
    return (await apiClient.post(`${BASE_URL}action/`, { table, action, confirmation }, { suppressErrorToast: true })).data;
  },
};
