import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import SmartPlant3DPage from '../../src/pages/Engineering/Digitization/SmartPlant3DPage';
import Layout from '../../src/components/Layout/Layout';
import '../../src/index.css';

const user = { id: 11, first_name: 'Firaol', last_name: 'A', email: 's3d@example.test', user: { id: 11, first_name: 'Firaol', is_superuser: true }, roles: [] };
const store = configureStore({ reducer: { auth: (state = { isAuthenticated: true, user }) => state, theme: (state = { mode: 'light' }) => state, rbac: (state = { currentUser: user }) => state } });
const entry = new URLSearchParams(window.location.search).get('entry') || '/engineering/digitization/smart-plant-3d';
createRoot(document.getElementById('root')).render(<Provider store={store}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[entry]}><Routes><Route element={<Layout />}><Route path="/engineering/digitization/smart-plant-3d" element={<SmartPlant3DPage />} /></Route></Routes></MemoryRouter></QueryClientProvider></Provider>);
