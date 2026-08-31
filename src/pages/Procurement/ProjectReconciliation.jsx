import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  GitMerge,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { toast } from "react-toastify";
import apiClient from "../../services/api.service";
import * as projectControl from "../../services/projectControl.service";

const PAGE_SIZE = 12;
const TYPE_LABELS = {
  procurement_project: "Procurement project",
  purchase_requisition: "Purchase requisition",
  purchase_order: "Purchase order",
  invoice: "Finance invoice",
};
const REASON_LABELS = {
  no_exact_match: "No exact code match",
  multiple_projects: "Multiple project references",
  missing_po_match: "No verified PO match",
  no_verified_po: "PO match has exceptions",
};

const Metric = ({ label, value, tone = "slate" }) => {
  const tones = {
    slate: "border-slate-200 bg-white text-slate-900",
    teal: "border-teal-200 bg-teal-50 text-teal-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
  };
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <p className="text-2xl font-bold">{value ?? 0}</p>
      <p className="mt-1 text-xs font-semibold opacity-70">{label}</p>
    </div>
  );
};

const ProjectReconciliation = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [recordType, setRecordType] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [projectId, setProjectId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [allocationMode, setAllocationMode] = useState(false);
  const [wbsNodes, setWbsNodes] = useState([]);
  const [budgetAllocations, setBudgetAllocations] = useState([]);
  const [wbsId, setWbsId] = useState("");
  const [budgetId, setBudgetId] = useState("");
  const [allocationAmount, setAllocationAmount] = useState("");
  const [invoiceMode, setInvoiceMode] = useState(false);
  const [purchaseOrderId, setPurchaseOrderId] = useState("");

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiClient.get(
        "/procurement/projects/relationship-report/",
      );
      setData(response.data);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Could not load the project reconciliation report.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReport();
  }, [loadReport]);
  useEffect(() => {
    setPage(1);
  }, [search, recordType]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.unresolved || []).filter((row) => {
      if (recordType && row.record_type !== recordType) return false;
      if (!query) return true;
      return [
        row.identifier,
        row.title,
        row.reference,
        TYPE_LABELS[row.record_type],
      ].some((value) =>
        JSON.stringify(value || "")
          .toLowerCase()
          .includes(query),
      );
    });
  }, [data, search, recordType]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visibleRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const beginResolution = (row) => {
    setSelected(row);
    setAllocationMode(false);
    setInvoiceMode(row.record_type === "invoice");
    setProjectId("");
    setPurchaseOrderId("");
    setReason("");
    setAllocationAmount(
      row.record_type === "invoice"
        ? String(row.invoice_match?.remaining_amount || row.amount || "")
        : "",
    );
  };

  const beginAllocation = (row) => {
    setSelected(row);
    setAllocationMode(true);
    setInvoiceMode(false);
    setProjectId("");
    setWbsId("");
    setBudgetId("");
    setReason("");
    setAllocationAmount(
      String(row.allocation?.remaining_amount || row.amount || ""),
    );
  };

  useEffect(() => {
    if (!allocationMode || !projectId) {
      setWbsNodes([]);
      setBudgetAllocations([]);
      return;
    }
    Promise.all([
      projectControl.listWbsNodes(projectId),
      projectControl.listBudgetAllocations(projectId),
    ])
      .then(([nodes, budgets]) => {
        setWbsNodes(Array.isArray(nodes) ? nodes : nodes?.results || []);
        setBudgetAllocations(
          (Array.isArray(budgets) ? budgets : budgets?.results || []).filter(
            (row) => row.status === "approved",
          ),
        );
      })
      .catch(() => toast.error("Could not load WBS and budget choices."));
  }, [allocationMode, projectId]);

  const saveResolution = async () => {
    if (!selected || !projectId) return;
    setSaving(true);
    try {
      const response = await apiClient.post(
        "/procurement/projects/resolve-relationship/",
        {
          record_type: selected.record_type,
          record_id: selected.id,
          enterprise_project_id: projectId,
          reason,
        },
      );
      const propagated = response.data?.propagated || 0;
      toast.success(
        `Project assigned${propagated ? `; ${propagated} linked record(s) updated` : ""}.`,
      );
      setSelected(null);
      await loadReport();
    } catch (err) {
      const detail = err.response?.data;
      const message =
        typeof detail === "string"
          ? detail
          : detail?.enterprise_project_id?.[0] ||
            detail?.detail ||
            "Could not save the project assignment.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const saveAllocation = async () => {
    if (!selected || !projectId || !wbsId || !allocationAmount) return;
    setSaving(true);
    try {
      const created = await projectControl.createCostAllocation({
        project: projectId,
        wbs_node: wbsId,
        budget_allocation: budgetId || null,
        source_type: selected.record_type,
        source_id: selected.id,
        amount: allocationAmount,
        notes: reason,
      });
      await projectControl.approveCostAllocation(created.id);
      toast.success(
        "WBS allocation approved and included in the controlled cost flow.",
      );
      setSelected(null);
      await loadReport();
    } catch (err) {
      const detail = err.response?.data;
      toast.error(
        detail?.amount?.[0] ||
          detail?.wbs_node?.[0] ||
          detail?.detail ||
          "Could not save the WBS allocation.",
      );
    } finally {
      setSaving(false);
    }
  };

  const saveInvoiceMatch = async () => {
    if (!selected || !purchaseOrderId || !allocationAmount) return;
    setSaving(true);
    try {
      const response = await apiClient.post(
        "/procurement/projects/resolve-invoice-po/",
        {
          invoice_id: selected.id,
          purchase_order_id: purchaseOrderId,
          allocated_amount: allocationAmount,
          reason,
        },
      );
      const matchStatus = response.data?.match_status;
      if (matchStatus === "verified") {
        toast.success("Invoice matched and verified by the three-way check.");
      } else {
        const exceptions = response.data?.exception_codes || [];
        toast.warning(
          `PO link saved for review${exceptions.length ? `: ${exceptions.join(", ").replaceAll("_", " ")}` : "."}`,
        );
      }
      setSelected(null);
      await loadReport();
    } catch (err) {
      const detail = err.response?.data;
      toast.error(
        detail?.allocated_amount?.[0] ||
          detail?.purchase_order_id?.[0] ||
          detail?.detail ||
          "Could not reconcile the invoice to the PO.",
      );
    } finally {
      setSaving(false);
    }
  };

  const summary = data?.summary || {};
  const linked = [
    "procurement_projects",
    "purchase_requisitions",
    "purchase_orders",
    "invoices",
  ].reduce((total, key) => total + (summary[key]?.linked_before || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <header className="rounded-3xl bg-[#071B2E] px-6 py-5 text-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <button
                type="button"
                onClick={() => navigate("/procurement/projects")}
                className="mt-1 rounded-xl bg-white/10 p-2 hover:bg-white/20"
                aria-label="Back to projects"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.2em] text-teal-300">
                  Cross-department data governance
                </p>
                <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
                  <GitMerge className="h-6 w-6 text-teal-300" />
                  Project Reconciliation
                </h1>
                <p className="mt-1 text-sm text-slate-300">
                  Connect Procurement records to the canonical Project used by
                  Project Control and Finance.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={loadReport}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20 disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh report
            </button>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Metric
            label="Canonical projects"
            value={summary.enterprise_projects}
            tone="teal"
          />
          <Metric label="Safely linked records" value={linked} tone="blue" />
          <Metric
            label="Unresolved total"
            value={summary.unresolved_total}
            tone="amber"
          />
          <Metric
            label="Unresolved PRs"
            value={summary.purchase_requisitions?.unresolved}
          />
          <Metric
            label="Unresolved POs"
            value={summary.purchase_orders?.unresolved}
          />
          <Metric
            label="Unresolved invoices"
            value={summary.invoices?.unresolved}
            tone="amber"
          />
        </section>

        <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <ShieldCheck className="mt-0.5 h-5 w-5 flex-none" />
          <p>
            <strong>Controlled migration:</strong> automatic matching only
            accepts exact project codes (ignoring case and extra spaces). Manual
            assignment keeps legacy references and financial values unchanged,
            and creates an audit record.
          </p>
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
            <div>
              <h2 className="font-bold text-slate-900">Unresolved records</h2>
              <p className="text-xs text-slate-500">
                {filtered.length} record(s) require review
              </p>
            </div>
            <div className="flex flex-1 flex-wrap justify-end gap-2">
              <div className="relative min-w-[260px] max-w-md flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search code, PR, PO, invoice or title"
                  className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </div>
              <select
                value={recordType}
                onChange={(event) => setRecordType(event.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
              >
                <option value="">All record types</option>
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex h-64 items-center justify-center gap-3 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
              Loading reconciliation report…
            </div>
          ) : error ? (
            <div className="flex h-64 flex-col items-center justify-center p-6 text-center">
              <AlertTriangle className="h-9 w-9 text-red-500" />
              <p className="mt-3 font-semibold text-red-700">{error}</p>
              <button
                type="button"
                onClick={loadReport}
                className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Try again
              </button>
            </div>
          ) : visibleRows.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="mt-3 font-semibold text-slate-800">
                No unresolved records in this view
              </p>
              <p className="text-sm text-slate-500">
                All displayed project references are reconciled.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Record</th>
                    <th className="px-4 py-3">Identifier</th>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Legacy reference</th>
                    <th className="px-4 py-3">Issue</th>
                    <th className="px-4 py-3">Allocation</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleRows.map((row) => (
                    <tr
                      key={`${row.record_type}-${row.id}`}
                      className="hover:bg-slate-50"
                    >
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {TYPE_LABELS[row.record_type]}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                        {row.identifier || "—"}
                      </td>
                      <td
                        className="max-w-xs truncate px-4 py-3 text-slate-700"
                        title={row.title}
                      >
                        {row.title || "—"}
                      </td>
                      <td className="max-w-xs px-4 py-3 font-mono text-xs text-slate-600">
                        {Array.isArray(row.reference)
                          ? row.reference.join(", ")
                          : row.reference || "—"}
                      </td>
                      <td className="px-4 py-3 text-amber-700">
                        {REASON_LABELS[row.reason] || row.reason}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                        {row.allocation ? (
                          <>
                            <span className="font-semibold capitalize">
                              {row.allocation.status.replaceAll("_", " ")}
                            </span>
                            <br />
                            {Number(row.allocation.approved_amount || 0).toLocaleString()} /{" "}
                            {Number(row.allocation.source_amount || 0).toLocaleString()} {row.currency}
                          </>
                        ) : row.invoice_match ? (
                          <>
                            <span className="font-semibold capitalize">
                              {row.invoice_match.status.replaceAll("_", " ")}
                            </span>
                            {!!row.invoice_match.existing_pos?.length && (
                              <><br />PO: {row.invoice_match.existing_pos.join(", ")}</>
                            )}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {row.allocation && row.record_type !== "invoice" && (
                            <button
                              type="button"
                              onClick={() => beginAllocation(row)}
                              className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                            >
                              Allocate WBS
                            </button>
                          )}
                        <button
                          type="button"
                          onClick={() => beginResolution(row)}
                          className="rounded-lg bg-teal-600 px-3 py-2 text-xs font-bold text-white hover:bg-teal-700"
                        >
                          {row.record_type === "invoice" ? "Match PO" : "Assign project"}
                        </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && !error && filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
              <span>
                Page {page} of {pages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  disabled={page === 1}
                  className="rounded-lg border border-slate-300 p-2 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPage((value) => Math.min(pages, value + 1))}
                  disabled={page === pages}
                  className="rounded-lg border border-slate-300 p-2 disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </section>

        {!!data?.recent_resolutions?.length && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-900">
              Recent relationship changes
            </h2>
            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              {data.recent_resolutions.slice(0, 8).map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs"
                >
                  <span className="text-slate-600">
                    {TYPE_LABELS[row.record_type]} · {row.resolution}
                  </span>
                  <strong className="text-slate-900">
                    {row.enterprise_project_code || "Unassigned"}
                  </strong>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900">
              {invoiceMode
                ? "Match invoice to purchase order"
                : allocationMode
                  ? "Allocate record to WBS"
                  : "Assign canonical project"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {TYPE_LABELS[selected.record_type]}{" "}
              <strong className="text-slate-800">{selected.identifier}</strong>
            </p>
            {!invoiceMode && <label className="mt-5 block text-xs font-bold uppercase tracking-wide text-slate-600">
              Enterprise project
              <select
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-normal normal-case text-slate-900"
              >
                <option value="">Select the verified project…</option>
                {(data?.canonical_projects || []).map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.code} — {project.name} ({project.currency || "AED"})
                  </option>
                ))}
              </select>
            </label>}
            {invoiceMode && (
              <div className="mt-5 space-y-4">
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-600">
                  Canonical purchase order
                  <select
                    value={purchaseOrderId}
                    onChange={(event) => setPurchaseOrderId(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-normal normal-case text-slate-900"
                  >
                    <option value="">Select the verified PO…</option>
                    {(data?.purchase_order_choices || []).map((order) => (
                      <option key={order.id} value={order.id}>
                        {order.po_number} — {order.project_code} — {order.vendor_name} — {Number(order.amount).toLocaleString()} {order.currency}{order.has_accepted_receipt ? " — receipt accepted" : " — no accepted receipt"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-600">
                  Invoice allocation amount
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={allocationAmount}
                    onChange={(event) => setAllocationAmount(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm font-normal normal-case text-slate-900"
                  />
                  <span className="mt-1 block font-normal normal-case text-slate-400">
                    Remaining invoice value: {Number(selected.invoice_match?.remaining_amount ?? selected.amount ?? 0).toLocaleString()} {selected.currency}
                  </span>
                </label>
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Saving runs the three-way PO, receipt and invoice check. Exceptions remain pending and do not become verified actual cost.
                </p>
              </div>
            )}
            {allocationMode && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-bold uppercase tracking-wide text-slate-600">
                  WBS node
                  <select
                    value={wbsId}
                    onChange={(event) => {
                      setWbsId(event.target.value);
                      setBudgetId("");
                    }}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-normal normal-case text-slate-900"
                  >
                    <option value="">Select WBS…</option>
                    {wbsNodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.code} — {node.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-bold uppercase tracking-wide text-slate-600">
                  Approved budget
                  <select
                    value={budgetId}
                    onChange={(event) => setBudgetId(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-normal normal-case text-slate-900"
                  >
                    <option value="">No budget line</option>
                    {budgetAllocations
                      .filter((budget) => !wbsId || String(budget.wbs_node) === String(wbsId))
                      .map((budget) => (
                        <option key={budget.id} value={budget.id}>
                          {budget.code} — {budget.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="text-xs font-bold uppercase tracking-wide text-slate-600 sm:col-span-2">
                  Allocation amount
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={allocationAmount}
                    onChange={(event) => setAllocationAmount(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm font-normal normal-case text-slate-900"
                  />
                  <span className="mt-1 block font-normal normal-case text-slate-400">
                    Remaining source value: {Number(selected.allocation?.remaining_amount || 0).toLocaleString()}
                  </span>
                </label>
              </div>
            )}
            <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-slate-600">
              {invoiceMode ? "Match evidence note" : allocationMode ? "Allocation note" : "Resolution note"}
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Why this relationship is correct (recommended)"
                className="mt-2 w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal normal-case text-slate-900"
              />
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelected(null)}
                disabled={saving}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={invoiceMode ? saveInvoiceMatch : allocationMode ? saveAllocation : saveResolution}
                disabled={
                  saving ||
                  (invoiceMode
                    ? !purchaseOrderId || !allocationAmount
                    : !projectId || (allocationMode && (!wbsId || !allocationAmount)))
                }
                className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {invoiceMode
                  ? "Save and run three-way check"
                  : allocationMode
                    ? "Create and approve allocation"
                    : "Confirm assignment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectReconciliation;
