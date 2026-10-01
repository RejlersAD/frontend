import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
// Load the application's eagerly imported styles as well as the real shared shell.
// App is not mounted: route data and identity remain isolated synthetic fixtures.
import '../../src/App';
import Layout from '../../src/components/Layout/Layout';
import SalesLifecycleArea from '../../src/pages/Sales/SalesLifecycleArea';
import '../../src/index.css';

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
const entry = new URLSearchParams(window.location.search).get('entry') || '/sales/opportunities';
createRoot(document.getElementById('root')).render(
  <Provider store={store}>
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes><Route element={<Layout />}><Route path="/sales/:area" element={<SalesLifecycleArea />} /></Route></Routes>
      </MemoryRouter>
    </QueryClientProvider>
  </Provider>,
);
