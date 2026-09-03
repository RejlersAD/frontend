import React from 'react';
import { useNavigate } from 'react-router-dom';
import PurchaseOrderForm from './PurchaseOrderForm';

const PurchaseOrderPage = () => {
  const navigate = useNavigate();

  const returnToRegister = () => navigate('/procurement/orders');

  return (
    <PurchaseOrderForm
      isOpen
      pageMode
      onClose={returnToRegister}
      onSuccess={returnToRegister}
    />
  );
};

export default PurchaseOrderPage;