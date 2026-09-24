import { useId } from 'react';
import PropTypes from 'prop-types';
import './GoodsReceiptActions.css';

export const receiptConfirmationBlock = receipt => receipt.confirmation?.can_confirm === true ? '' : receipt.confirmation?.blocked_reason || (receipt.status !== 'pending' ? 'Only pending receipts can be confirmed.' : 'Refresh receipt details to check confirmation availability.');
export const receiptDeletionBlock = receipt => receipt.deletion?.can_delete === true ? '' : receipt.deletion?.blocked_reason || (receipt.status !== 'pending' ? 'Confirmed or decided receipts cannot be deleted.' : 'Refresh receipt details to check deletion availability.');

export default function GoodsReceiptActions({ receipt, onOpen, onDelete, showOpen = false }) {
  const id = useId();
  const confirmBlock = receiptConfirmationBlock(receipt);
  const deleteBlock = receiptDeletionBlock(receipt);
  return <div className="gr-actions" aria-label={`Actions for ${receipt.receipt_number || 'receipt'}`}>
    <div className="gr-actions-buttons">
      {showOpen && <button type="button" onClick={() => onOpen(receipt)}>Open</button>}
      <button type="button" className="gr-action-confirm" onClick={() => onOpen(receipt)} disabled={!!confirmBlock} aria-describedby={confirmBlock ? `${id}-confirm` : undefined}>Confirm delivery</button>
      <button type="button" className="gr-action-delete" onClick={() => onDelete(receipt)} disabled={!!deleteBlock} aria-describedby={deleteBlock ? `${id}-delete` : undefined}>Delete receipt</button>
    </div>
    {confirmBlock && <p id={`${id}-confirm`}>{confirmBlock}</p>}
    {deleteBlock && <p id={`${id}-delete`}>{deleteBlock}</p>}
  </div>;
}
GoodsReceiptActions.propTypes = { receipt: PropTypes.object.isRequired, onOpen: PropTypes.func.isRequired, onDelete: PropTypes.func.isRequired, showOpen: PropTypes.bool };
