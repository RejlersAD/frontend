import PropTypes from 'prop-types';
import FinanceCommandCenter from '../../components/Finance/FinanceCommandCenter';
import './ExecutiveReceivables.css';

export default function FinancialPerformance({ refreshKey = 0, printing = false, onSnapshotChange }) {
  return <div className="financial-performance" data-testid="financial-performance">
    <FinanceCommandCenter embedded dataScope="executive" refreshKey={refreshKey} printing={printing} onSnapshotChange={onSnapshotChange} />
    <p className="fp-receivables-basis">Current recorded invoice balances in the selected currency. Revenue recognition, profitability, treasury and approved forecasts require their own connected sources.</p>
  </div>;
}
FinancialPerformance.propTypes = { refreshKey: PropTypes.number, printing: PropTypes.bool, onSnapshotChange: PropTypes.func };
