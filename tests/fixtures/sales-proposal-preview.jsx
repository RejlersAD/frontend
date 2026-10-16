import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import '../../src/App';
import Layout from '../../src/components/Layout/Layout';
import SalesLifecycleArea from '../../src/pages/Sales/SalesLifecycleArea';
import SalesProposalPreviewPage from '../../src/pages/Sales/SalesProposalPreviewPage';
import ProposalWorkspacePage from '../../src/pages/ProposalWorkspacePage';
import '../../src/index.css';

// Synthetic identity and API fixtures only; the shared application shell is real.
const user = {
  id: 11, first_name: 'Aisha', last_name: 'Noor', email: 'aisha@example.test',
  user: { id: 11, first_name: 'Aisha', last_name: 'Noor', email: 'aisha@example.test', is_superuser: true },
  roles: [{ code: 'super_admin', name: 'Super Administrator' }],
};
const store = configureStore({ reducer: {
  auth: (state = { isAuthenticated: true, user }) => state,
  theme: (state = { mode: 'light' }) => state,
  rbac: (state = { currentUser: user }) => state,
} });
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const entry = new URLSearchParams(window.location.search).get('entry') || '/sales/proposals/proposal-one/preview';
createRoot(document.getElementById('root')).render(
  <Provider store={store}><QueryClientProvider client={queryClient}>
    <MemoryRouter initialEntries={[entry]}><Routes><Route element={<Layout />}>
      <Route path="/sales/proposals/:proposalId/preview" element={<SalesProposalPreviewPage />} />
      <Route path="/proposal-workspace/:projectId" element={<ProposalWorkspacePage />} />
      <Route path="/sales/:area" element={<SalesLifecycleArea />} />
    </Route></Routes></MemoryRouter>
  </QueryClientProvider></Provider>,
);
