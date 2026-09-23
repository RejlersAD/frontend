import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../services/api.service';
import PortfolioWorkbookUpload from '../../components/portfolio/PortfolioWorkbookUpload';
import { formatDate } from '../Executive/executivePresentation';
import './PortfolioWorkbookImport.css';

async function readWorkbook(signal) {
  const { data } = await apiClient.get('/dashboard/executive/portfolio-workbook/', {
    params: { limit: 1 }, signal, suppressErrorToast: true,
  });
  if (typeof data?.can_upload !== 'boolean') throw new Error('Workbook status is unavailable.');
  return data;
}

export default function PortfolioWorkbookImport() {
  const [workbook, setWorkbook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const active = useRef(false);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(false);
    readWorkbook(controller.signal).then(data => {
      if (!controller.signal.aborted) setWorkbook(data);
    }).catch(problem => {
      if (controller.signal.aborted) return;
      if ([401, 403].includes(problem.response?.status)) setWorkbook({ can_upload: false });
      else setError(true);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);

  const refreshWorkbook = useCallback(async () => {
    const data = await readWorkbook();
    if (active.current) setWorkbook(data);
  }, []);

  if (loading) return <div className="plw-workbook-loading" role="status">Loading workbook upload options…</div>;
  if (error) return <section className="plw-message plw-error" aria-label="Portfolio workbook upload">
    <span role="alert">Workbook upload options could not be loaded.</span>
    <button type="button" className="plw-button" onClick={() => setRevision(value => value + 1)}>Retry workbook options</button>
  </section>;
  if (!workbook?.can_upload) return null;

  const source = workbook.source;
  return <section className="plw-workbook-import" aria-label="Portfolio workbook management" data-testid="portfolio-workbook-import">
    <PortfolioWorkbookUpload onImported={refreshWorkbook} />
    <div className="plw-workbook-source" data-testid="portfolio-workbook-import-source">
      <p>{source ? <><strong>{source.file_name}</strong><span>Reporting date: {formatDate(source.reporting_date)}</span><span>{source.last_uploaded_at ? 'Last uploaded' : 'Imported'}: {formatDate(source.last_uploaded_at || source.imported_at, true)}</span></> : 'No portfolio workbook has been imported yet.'}</p>
      <Link to="/executive?tab=portfolio">Open project portfolio</Link>
    </div>
  </section>;
}
