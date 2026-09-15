import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Database, RefreshCw, Search, Trash2, X } from 'lucide-react';
import databaseMaintenanceService from '../../services/databaseMaintenance.service';

const actionLabel = action => action === 'drop' ? 'Delete table' : 'Delete data';
const rowCount = table => table.row_count == null
  ? 'Unavailable'
  : `${table.row_count.toLocaleString()}${table.row_count_is_estimate ? ' (estimate)' : ''}`;

const inventoryErrorMessage = error => {
  const status = error.response?.status;
  const detail = typeof error.response?.data?.detail === 'string' ? error.response.data.detail : '';
  if (error.isTimeout || ['ECONNABORTED', 'ETIMEDOUT'].includes(error.code)) {
    return 'Loading database tables timed out. The server may be busy; wait a moment and refresh tables.';
  }
  if (status === 404) {
    return 'Database cleaning is unavailable on the connected server (404). The server needs to load the database maintenance update before tables can be shown.';
  }
  if (status === 401) {
    return 'Your session has expired or you are not signed in (401). Sign in again to load database tables.';
  }
  if (status === 403) {
    return detail || 'Your account does not have permission to view database tables (403). Administrator access is required.';
  }
  if (status >= 500) {
    return detail || `The server could not load database tables (${status}). Check the backend logs, then refresh tables after the server issue is resolved.`;
  }
  if (error.isNetworkError || !error.response) {
    return 'Cannot reach the server to load database tables. Check your connection and that the backend is running, then refresh tables.';
  }
  return detail || `Unable to load database tables${status ? ` (${status})` : ''}. Refresh tables to try again.`;
};

export default function DatabaseCleaning({ active }) {
  const [inventory, setInventory] = useState(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [success, setSuccess] = useState('');
  const [selection, setSelection] = useState(null);
  const [confirmation, setConfirmation] = useState('');
  const [actionError, setActionError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const loadingRef = useRef(false);
  const mutationRef = useRef(false);
  const dialogRef = useRef(null);

  const loadTables = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setListError('');
    try {
      setInventory(await databaseMaintenanceService.getTables());
    } catch (error) {
      setListError(inventoryErrorMessage(error));
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active && !mutationRef.current) loadTables();
  }, [active, loadTables]);

  useEffect(() => {
    if (selection && active) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [selection, active]);

  const closeDialog = () => {
    if (!mutationRef.current) setSelection(null);
  };
  const openAction = (table, action) => {
    setConfirmation('');
    setActionError('');
    setSuccess('');
    setSelection({ table, action });
  };
  const currentTable = inventory?.tables?.find(table => table.name === selection?.table.name);
  const actionAllowed = inventory?.can_manage && currentTable?.[selection?.action === 'drop' ? 'can_drop' : 'can_clear'];

  const submitAction = async event => {
    event.preventDefault();
    if (!selection || mutationRef.current || loadingRef.current || listError || !actionAllowed || confirmation !== selection.table.name) return;
    mutationRef.current = true;
    setSubmitting(true);
    setActionError('');
    try {
      const result = await databaseMaintenanceService.performAction({
        table: selection.table.name,
        action: selection.action,
        confirmation,
      });
      setSuccess(result.message || `${actionLabel(selection.action)} completed for ${selection.table.name}.`);
      setSelection(null);
      await loadTables();
    } catch (error) {
      const detail = error.response?.data?.detail;
      const references = error.response?.data?.referenced_by;
      setActionError([
        detail || (error.response ? 'The database action failed.' : 'The request outcome could not be confirmed. Review the refreshed table list before trying again.'),
        references?.length ? `Referenced by: ${references.join(', ')}.` : '',
      ].filter(Boolean).join(' '));
      await loadTables();
    } finally {
      mutationRef.current = false;
      setSubmitting(false);
    }
  };

  const tables = inventory?.tables || [];
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = tables.filter(table => `${table.name} ${table.model || ''}`.toLowerCase().includes(normalizedQuery));

  return <section className="ac-panel ac-database-cleaning" aria-labelledby="ac-database-title">
    <div className="ac-panel-heading">
      <div><h2 id="ac-database-title"><Database size={19} />Database cleaning</h2><p className="ac-support">Inspect database tables and remove data or entire tables.</p></div>
      <button type="button" onClick={loadTables} disabled={loading || submitting}><RefreshCw size={16} className={loading ? 'ac-spin' : ''} />Refresh tables</button>
    </div>
    <p className="ac-database-warning"><AlertTriangle size={18} /><span>These actions permanently delete database content. Make sure a current backup is available before continuing. Related tables and protected system tables may block an action.</span></p>
    {inventory && !inventory.can_manage && <p className="ac-support">View only. A super administrator is required to delete data or tables.</p>}
    {success && <p className="ac-database-success" role="status"><CheckCircle2 size={18} />{success}</p>}
    {listError && <p className="ac-database-error" role="alert">{listError}{inventory ? ' Displayed tables may be out of date; actions are disabled until a refresh succeeds.' : ''}</p>}
    <div className="ac-database-toolbar">
      <label className="ac-search"><Search size={17} /><input aria-label="Search database tables" placeholder="Search table or model name" value={query} onChange={event => setQuery(event.target.value)} /></label>
      {inventory && <p className="ac-support">{filtered.length} of {tables.length} tables · Database: {inventory.database} · {inventory.engine === 'postgresql' ? 'PostgreSQL' : inventory.engine === 'sqlite' ? 'SQLite' : inventory.engine}</p>}
    </div>
    {loading && <p className="ac-support" role="status">Loading database tables…</p>}
    <div className="ac-table-scroll" aria-busy={loading}>
      <table aria-label="Database tables"><thead><tr><th scope="col">Table</th><th scope="col">Rows</th><th scope="col">Dependencies</th><th scope="col">Actions</th></tr></thead>
        <tbody>{filtered.map(table => {
          const clearReason = !inventory.can_manage ? 'Super administrator access required.' : table.clear_blocked_reason;
          const dropReason = !inventory.can_manage ? 'Super administrator access required.' : table.drop_blocked_reason;
          return <tr key={table.name}>
            <td><code className="ac-database-name">{table.name}</code><small>{table.model || (table.managed ? 'Application table' : 'No registered application model')}</small></td>
            <td className="ac-database-count">{rowCount(table)}</td>
            <td className="ac-database-dependencies">{table.referenced_by?.length ? <details><summary>{table.referenced_by.length} referencing {table.referenced_by.length === 1 ? 'table' : 'tables'}</summary><ul>{table.referenced_by.map(name => <li key={name}><code>{name}</code></li>)}</ul></details> : <span>No referencing tables</span>}</td>
            <td><div className="ac-database-actions">
              <div><button type="button" className="ac-danger-outline" aria-label={`Delete data from ${table.name}`} disabled={!inventory.can_manage || !table.can_clear || loading || submitting || !!listError} title={clearReason || 'Delete every row; keep the table structure.'} onClick={() => openAction(table, 'clear')}><Trash2 size={15} />Delete data</button>{clearReason && <small>{clearReason}</small>}</div>
              <div><button type="button" className="ac-danger-outline" aria-label={`Delete table ${table.name}`} disabled={!inventory.can_manage || !table.can_drop || loading || submitting || !!listError} title={dropReason || 'Permanently remove the table and its data.'} onClick={() => openAction(table, 'drop')}><X size={15} />Delete table</button>{dropReason && <small>{dropReason}</small>}</div>
            </div></td>
          </tr>;
        })}{!filtered.length && !loading && !listError && <tr><td className="ac-empty" colSpan={4}>{tables.length ? 'No tables match your search.' : 'No database tables found.'}</td></tr>}</tbody>
      </table>
    </div>
    <dialog ref={dialogRef} className="ac-dialog ac-database-dialog" aria-labelledby="ac-database-dialog-title" aria-describedby="ac-database-consequence" onCancel={event => { event.preventDefault(); closeDialog(); }} onClick={event => { if (event.target === event.currentTarget) closeDialog(); }}>
      <button type="button" className="ac-dialog-close" aria-label="Close database confirmation" disabled={submitting} onClick={closeDialog}><X size={20} /></button>
      <h2 id="ac-database-dialog-title">{actionLabel(selection?.action)}{selection ? `: ${selection.table.name}` : ''}</h2>
      <form onSubmit={submitAction}>
        <p id="ac-database-consequence" className="ac-database-warning">{selection?.action === 'drop'
          ? 'This permanently removes the table, its structure and all its data. Application features that use it may stop working. Recovery requires restoring the table and its data from a backup.'
          : 'This permanently deletes every row in this table and keeps its structure. Deleted data can only be recovered from a backup.'}</p>
        {selection && <p className="ac-support">Selected table: <code>{selection.table.name}</code> · Rows: {rowCount(selection.table)}</p>}
        <label htmlFor="ac-database-confirmation">Type the exact table name to confirm<input id="ac-database-confirmation" value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" spellCheck={false} disabled={submitting} required /></label>
        {actionError && <p className="ac-database-error" role="alert">{actionError}</p>}
        {listError && <p className="ac-database-error" role="alert">Close this dialog and refresh tables before retrying.</p>}
        {!loading && selection && !actionAllowed && <p className="ac-database-error" role="alert">This action is no longer available. Close this dialog and review the table list.</p>}
        <div className="ac-database-dialog-actions"><button type="button" onClick={closeDialog} disabled={submitting}>Cancel</button><button className="ac-danger" type="submit" disabled={submitting || loading || !!listError || !actionAllowed || confirmation !== selection?.table.name}>{submitting ? 'Processing…' : actionLabel(selection?.action)}</button></div>
      </form>
    </dialog>
  </section>;
}
