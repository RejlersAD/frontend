import React, { useEffect, useState } from 'react';
import { ArrowLeftIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../../services/api.service';
import PurchaseRequisitionForm from './PurchaseRequisitionForm';

const REGISTER_PATH = '/procurement/requisitions';

const PurchaseRequisitionPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [editData, setEditData] = useState(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return undefined;

    let cancelled = false;
    const loadRequisition = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await apiClient.get(`/procurement/requisitions/${id}/`, {
          params: { _fresh: Date.now() },
        });
        if (!cancelled) setEditData(response.data);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.response?.data?.detail || 'The Purchase Recommendation could not be loaded.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadRequisition();
    return () => { cancelled = true; };
  }, [id]);

  const returnToRegister = () => navigate(REGISTER_PATH);

  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center bg-slate-100">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600" />
          <p className="mt-3 text-sm font-medium text-slate-600">Loading Purchase Recommendation…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 p-5">
        <div className="mx-auto max-w-2xl rounded-xl border border-red-200 bg-white p-6 shadow-sm">
          <ExclamationTriangleIcon className="h-9 w-9 text-red-500" />
          <h1 className="mt-3 text-lg font-bold text-slate-900">Unable to open Purchase Recommendation</h1>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
          <button type="button" onClick={returnToRegister} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700">
            <ArrowLeftIcon className="h-4 w-4" /> Back to register
          </button>
        </div>
      </div>
    );
  }

  return (
    <PurchaseRequisitionForm
      isOpen
      pageMode
      editData={editData}
      onClose={returnToRegister}
      onSuccess={returnToRegister}
    />
  );
};

export default PurchaseRequisitionPage;
