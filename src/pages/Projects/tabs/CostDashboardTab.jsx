import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import {
  ArrowPathIcon,
  PlusIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";

import * as PC from "../../../services/projectControl.service";
import { COST_KPI_CARDS } from "../../../config/projectControl.config";
import KpiCard from "../components/KpiCard";

const CHART_COLORS = {
  budget: "#6366f1",
  committed: "#0ea5e9",
  spent: "#f59e0b",
  remaining: "#10b981",
};

export default function CostDashboardTab({ project }) {
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [wbsNodes, setWbsNodes] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [savingBudget, setSavingBudget] = useState(false);
  const [budgetForm, setBudgetForm] = useState({
    wbs_node: "",
    wbs_code: "",
    wbs_name: "",
    code: "",
    name: "",
    amount: "",
    category: "",
    currency: project.currency || "AED",
  });

  const rows = (value) => (Array.isArray(value) ? value : value?.results || []);

  const reload = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      PC.getCostKpis(project.id),
      PC.listWbsNodes(project.id),
      PC.listBudgetAllocations(project.id),
      PC.listCostLedger(project.id, { status: "posted" }),
    ])
      .then(([nextKpis, nextWbs, nextBudgets, nextLedger]) => {
        setKpis(nextKpis);
        setWbsNodes(rows(nextWbs));
        setBudgets(rows(nextBudgets));
        setLedger(rows(nextLedger));
      })
      .catch((e) =>
        setError(
          e?.response?.data?.error || e?.message || "Failed to load KPIs",
        ),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload(); /* eslint-disable-next-line */
  }, [project.id]);

  const runSync = () => {
    setSyncing(true);
    setSyncMessage(null);
    PC.runFinanceSync(project.id)
      .then((res) => {
        const currencyExceptions =
          res.ledger_totals?.currency_exceptions?.length || 0;
        if (currencyExceptions) {
          setSyncMessage(
            `Ledger rebuilt. ${currencyExceptions} source(s) were excluded because their currency differs from the project currency.`,
          );
          reload();
          return;
        }
        if (res.skipped) {
          setSyncMessage("Finance module not installed — skipped.");
        } else {
          setSyncMessage(
            `Matched ${res.matched_invoices} invoice(s) totalling ${res.total_spent}.`,
          );
        }
        reload();
      })
      .catch((e) =>
        setSyncMessage(e?.response?.data?.error || "Finance sync failed."),
      )
      .finally(() => setSyncing(false));
  };

  const saveBudget = async (event) => {
    event.preventDefault();
    setSavingBudget(true);
    setSyncMessage(null);
    try {
      let wbsId = budgetForm.wbs_node;
      if (!wbsId) {
        const created = await PC.createWbsNode({
          project: project.id,
          code: budgetForm.wbs_code,
          name: budgetForm.wbs_name,
          level: 0,
          sort_order: wbsNodes.length,
        });
        wbsId = created.id;
      }
      await PC.createBudgetAllocation({
        project: project.id,
        wbs_node: wbsId,
        code: budgetForm.code,
        name: budgetForm.name,
        category: budgetForm.category,
        amount: budgetForm.amount,
        currency: budgetForm.currency,
      });
      setShowBudgetForm(false);
      setBudgetForm({
        wbs_node: "",
        wbs_code: "",
        wbs_name: "",
        code: "",
        name: "",
        amount: "",
        category: "",
        currency: project.currency || "AED",
      });
      setSyncMessage(
        "Draft WBS budget created. Approve it before it affects KPIs.",
      );
      reload();
    } catch (e) {
      setSyncMessage(
        e?.response?.data?.amount?.[0] ||
          e?.response?.data?.detail ||
          "Could not create the budget allocation.",
      );
    } finally {
      setSavingBudget(false);
    }
  };

  const approveBudget = async (id) => {
    try {
      await PC.approveBudgetAllocation(id);
      setSyncMessage("Budget approved and posted to the cost ledger.");
      reload();
    } catch (e) {
      setSyncMessage(
        e?.response?.data?.detail || "Could not approve the budget.",
      );
    }
  };

  if (loading)
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500">
        Loading cost KPIs…
      </div>
    );
  if (error)
    return (
      <div className="bg-white border border-rose-200 text-rose-700 rounded-xl p-6">
        {error}
      </div>
    );
  if (!kpis) return null;

  const chartData = [
    {
      name: "Budget",
      value: Number(kpis.budget || 0),
      fill: CHART_COLORS.budget,
    },
    {
      name: "Committed",
      value: Number(kpis.committed || 0),
      fill: CHART_COLORS.committed,
    },
    { name: "Spent", value: Number(kpis.spent || 0), fill: CHART_COLORS.spent },
    {
      name: "Remaining",
      value: Number(kpis.remaining || 0),
      fill: CHART_COLORS.remaining,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            WBS Cost Control
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            KPIs below use posted ledger entries only—not editable Project
            totals.
          </p>
        </div>
        <button
          onClick={() => setShowBudgetForm(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          <PlusIcon className="h-4 w-4" />
          WBS Budget
        </button>
      </div>
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {COST_KPI_CARDS.map((card) => (
          <KpiCard
            key={card.key}
            label={card.label}
            value={kpis[card.field]}
            tone={card.tone}
            isCurrency={card.isCurrency}
            isPercent={card.isPercent}
            currency={kpis.currency}
          />
        ))}
      </div>

      {/* Chart + forecast */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-800">
              Cost Breakdown
            </h3>
            <button
              onClick={runSync}
              disabled={syncing}
              className="text-xs px-3 py-1.5 inline-flex items-center gap-1.5 rounded-md
                         bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
            >
              <ArrowPathIcon
                className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`}
              />
              {syncing ? "Syncing…" : "Sync from Finance"}
            </button>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, bottom: 10, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: "#64748b" }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  tickFormatter={(v) => v.toLocaleString()}
                />
                <Tooltip
                  formatter={(v) =>
                    Number(v).toLocaleString(undefined, {
                      style: "currency",
                      currency: kpis.currency || "AED",
                      maximumFractionDigits: 0,
                    })
                  }
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {syncMessage && (
            <p className="mt-2 text-xs text-slate-500">{syncMessage}</p>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">
            Forecast (EVM)
          </h3>
          <div className="space-y-3 text-sm">
            <Row
              label="EAC (forecast)"
              value={
                kpis.forecast?.eac
                  ? Number(kpis.forecast.eac).toLocaleString()
                  : "—"
              }
            />
            <Row label="CPI" value={kpis.forecast?.cpi ?? "—"} />
            <Row label="SPI" value={kpis.forecast?.spi ?? "—"} />
            <Row
              label="Last snapshot"
              value={kpis.forecast?.snapshot_date || "—"}
            />
          </div>
          <p className="text-xs text-slate-400 mt-4">
            Full EVM lights up when Phase 3 is enabled.
          </p>
        </div>
      </div>

      {/* Estimate counts */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard
          label="Estimates · total"
          value={kpis.estimate_counts?.total}
          tone="indigo"
        />
        <KpiCard
          label="Estimates · approved"
          value={kpis.estimate_counts?.approved}
          tone="green"
        />
        <KpiCard
          label="Estimates · draft"
          value={kpis.estimate_counts?.draft}
          tone="slate"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-800">
              WBS Budget Allocations
            </h3>
            <p className="text-xs text-slate-500">
              Only approved rows post to the ledger.
            </p>
          </div>
          <div className="max-h-72 overflow-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2">WBS</th>
                  <th className="px-4 py-2">Budget</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {budgets.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 font-medium">{row.wbs_code}</td>
                    <td className="px-4 py-3">
                      {row.code} · {row.name}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {Number(row.amount).toLocaleString()} {row.currency}
                    </td>
                    <td className="px-4 py-3">
                      {row.status === "draft" ? (
                        <button
                          onClick={() => approveBudget(row.id)}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 font-semibold text-emerald-700"
                        >
                          <CheckIcon className="h-3 w-3" />
                          Approve
                        </button>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-1 font-medium">
                          {row.status}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {!budgets.length && (
                  <tr>
                    <td
                      colSpan="4"
                      className="px-4 py-8 text-center text-slate-400"
                    >
                      No WBS budgets yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-800">
              Posted Cost Ledger
            </h3>
            <p className="text-xs text-slate-500">
              {kpis.ledger_entry_count || 0} active entries · source:{" "}
              {kpis.calculation_source}
            </p>
          </div>
          <div className="max-h-72 overflow-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Source</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledger.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3">{row.entry_date}</td>
                    <td className="px-4 py-3 capitalize">{row.entry_type}</td>
                    <td className="px-4 py-3">
                      {row.wbs_code ? `${row.wbs_code} · ` : ""}
                      {row.source_reference || row.source_type}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {Number(row.amount).toLocaleString()} {row.currency}
                    </td>
                  </tr>
                ))}
                {!ledger.length && (
                  <tr>
                    <td
                      colSpan="4"
                      className="px-4 py-8 text-center text-slate-400"
                    >
                      Run ledger sync after approving a budget or linking a PO.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {showBudgetForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form
            onSubmit={saveBudget}
            className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h2 className="text-lg font-bold text-slate-900">
              Create WBS Budget
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Create a draft allocation, then approve it from the table.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-semibold text-slate-600">
                Existing WBS
                <select
                  value={budgetForm.wbs_node}
                  onChange={(e) =>
                    setBudgetForm({ ...budgetForm, wbs_node: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
                >
                  <option value="">Create a new WBS node</option>
                  {wbsNodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.code} — {node.name}
                    </option>
                  ))}
                </select>
              </label>
              {!budgetForm.wbs_node && (
                <>
                  <label className="text-xs font-semibold text-slate-600">
                    New WBS code
                    <input
                      required
                      value={budgetForm.wbs_code}
                      onChange={(e) =>
                        setBudgetForm({
                          ...budgetForm,
                          wbs_code: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
                      placeholder="1.2"
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    New WBS name
                    <input
                      required
                      value={budgetForm.wbs_name}
                      onChange={(e) =>
                        setBudgetForm({
                          ...budgetForm,
                          wbs_name: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
                      placeholder="Procurement"
                    />
                  </label>
                </>
              )}
              <label className="text-xs font-semibold text-slate-600">
                Budget code
                <input
                  required
                  value={budgetForm.code}
                  onChange={(e) =>
                    setBudgetForm({ ...budgetForm, code: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
                  placeholder="BUD-PROC-001"
                />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Budget name
                <input
                  required
                  value={budgetForm.name}
                  onChange={(e) =>
                    setBudgetForm({ ...budgetForm, name: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
                />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Category
                <input
                  value={budgetForm.category}
                  onChange={(e) =>
                    setBudgetForm({ ...budgetForm, category: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
                />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Amount
                <input
                  required
                  min="0.01"
                  step="0.01"
                  type="number"
                  value={budgetForm.amount}
                  onChange={(e) =>
                    setBudgetForm({ ...budgetForm, amount: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBudgetForm(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                disabled={savingBudget}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {savingBudget ? "Saving…" : "Create draft"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-b-0 last:pb-0">
      <span className="text-slate-500 text-xs uppercase tracking-wider">
        {label}
      </span>
      <span className="text-slate-800 font-medium">{value}</span>
    </div>
  );
}
