import React from 'react';
import PropTypes from 'prop-types';
import { ArrowTopRightOnSquareIcon, CheckBadgeIcon } from '@heroicons/react/24/outline';
import { PROCUREMENT_DOCUMENT_BRANDING } from '../../config/procurementDocumentBranding.config';
import { convertToAed } from '../../config/procurement.config';
import { displayApprovalWorkflow, nameOnly } from '../../utils/employeeDisplayName';

const valueOrDash = (value) => (value === null || value === undefined || value === '' ? '—' : value);

const dateForDocument = (value) => {
  if (!value) return '—';
  const clean = String(value).slice(0, 10);
  const [year, month, day] = clean.split('-');
  return year && month && day ? `${day}.${month}.${year}` : value;
};

const timestampForDocument = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return valueOrDash(value);
  return `${parsed.toLocaleString('en-GB', {
    timeZone: 'Asia/Dubai',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })} GST`;
};

const money = (amount, currency) => {
  if (amount === null || amount === undefined || amount === '') return '—';
  const parsed = Number(amount);
  return Number.isFinite(parsed)
    ? `${currency || ''} ${parsed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim()
    : `${currency || ''} ${amount}`.trim();
};

const workflowRoleLabel = (stage, index) => {
  if (stage?.approval_label) return stage.approval_label;
  const role = `${stage?.role || ''} ${stage?.stage || ''}`.toLowerCase();
  if (role.includes('procurement')) return 'L0- PRO';
  if (role.includes('general manager') || role.includes('ceo')) return 'CEO';
  if (role.includes('engineering')) return 'L2 MoE';
  if (role.includes('manager of projects') || role.includes('projects manager')) return 'L3 MoP';
  if (role.includes('vice president') || role.includes('vp delivery') || role.includes('vp operations')) return 'L4 VOP/VP';
  if (role.includes('level 1')) return `L1-${stage?._levelOneIndex || index + 1}`;
  return stage?.role || `L${stage?.level || index + 1}`;
};

const PurchaseRequisitionDocumentPreview = ({ requisition, live = false }) => {
  const metadata = requisition.price_remarks_data || {};
  const negotiationRemarks = requisition.price_remarks || metadata.negotiation_remarks;
  const signedDocument = (requisition.attachments || []).find((item) => (
    item?.type === 'signed_purchase_requisition_pdf'
    || item?.document_type === 'signed_purchase_requisition_pdf'
  ));
  const sourceUrl = signedDocument?.url || signedDocument?.s3_url;
  const priceLines = Array.isArray(requisition.items) && requisition.items.length
    ? requisition.items
    : (metadata.price_lines || []);
  const selectedVendor = (requisition.selected_vendors || [])[0] || {};
  const icv = metadata.icv || selectedVendor.icv_percentage || selectedVendor.icv_value;
  const budget = metadata.budget_in_aed || requisition.estimated_budget;
  const calculatedNetTotalAed = convertToAed(requisition.net_total_excl_vat, requisition.currency);
  const netTotalAed = metadata.net_total_aed !== null && metadata.net_total_aed !== undefined && metadata.net_total_aed !== ''
    ? Number(metadata.net_total_aed)
    : calculatedNetTotalAed;
  const rawConfiguredWorkflow = Array.isArray(requisition.approval_workflow_config)
    ? requisition.approval_workflow_config
    : (Array.isArray(requisition.approval_hierarchy) ? requisition.approval_hierarchy : []);
  const configuredWorkflow = displayApprovalWorkflow(
    rawConfiguredWorkflow,
    requisition.po_number_reference,
  );
  const savedApprovalLabels = metadata.approval_table_labels || {};
  const persistedApprovalRows = [
    ['PM', requisition.pm_name_display, requisition.pm_signature, requisition.pm_approval_status, requisition.pm_approved_at],
    ['MoE', requisition.eng_manager_name_display, requisition.eng_manager_signature, requisition.eng_manager_approval_status, requisition.eng_manager_approved_at],
    ['MoP', requisition.manager_projects_name_display, requisition.manager_projects_signature, requisition.manager_projects_approval_status, requisition.manager_projects_approved_at],
    ['Vp, Op', requisition.vp_op_name_display, requisition.vp_op_signature, requisition.vp_op_approval_status, requisition.vp_op_approved_at],
  ];
  let levelOneDisplayIndex = 0;
  const approvalRows = configuredWorkflow.length
    ? configuredWorkflow.map((stage, index) => {
      const roleText = `${stage?.role || ''} ${stage?.stage || ''}`.toLowerCase();
      const isLevelOne = Number(stage?.level) === 1 || roleText.includes('level 1');
      if (isLevelOne) levelOneDisplayIndex += 1;
      return ([
        workflowRoleLabel({
          ...stage,
          _levelOneIndex: isLevelOne ? levelOneDisplayIndex : undefined,
          approval_label: stage.approval_label || savedApprovalLabels[stage.user_id || stage.approver_id],
        }, index),
        nameOnly(stage.user_name || stage.approver_name || stage.approver),
        stage.signature,
        stage.status,
        stage.approved_at || stage.decided_at,
      ]);
    })
    : persistedApprovalRows;
  const approvalDate = requisition.approved_at
    || requisition.vp_op_approved_at
    || metadata.signed_approval_date;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{live ? 'Live Purchase Recommendation Preview' : 'Captured PR Detail Preview'}</p>
          <p className="mt-1 text-xs text-gray-500">{live ? 'Updates as you complete the form' : 'Aligned with company form'} {requisition.form_reference || 'RAD-OM-PRC-0001 FRM -1 Rev 0'}</p>
        </div>
        {sourceUrl && (
          <a href={sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">
            <ArrowTopRightOnSquareIcon className="h-4 w-4" /> View Original Signed PDF
          </a>
        )}
      </div>

      <article className="overflow-hidden border-2 border-gray-700 bg-white text-[12px] leading-snug text-gray-900 shadow-sm">
        <div className="grid grid-cols-[2fr_1fr] border-b border-gray-700">
          <h3 className="px-4 py-3 text-center text-2xl font-bold">Purchase Requisition</h3>
          <div className="flex items-center justify-center border-l border-gray-700 px-3 py-2">
            <img
              src={PROCUREMENT_DOCUMENT_BRANDING.logo.path}
              alt={PROCUREMENT_DOCUMENT_BRANDING.logo.alt}
              className="h-5 w-auto max-w-[120px] object-contain"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 border-b border-gray-700 sm:grid-cols-3">
          <div className="px-2 py-2"><span className="font-semibold">Issued by:</span> {valueOrDash(requisition.issued_by_name)}</div>
          <div className="border-y border-gray-700 px-2 py-2 sm:border-x sm:border-y-0"><span className="font-semibold">PR No.</span> {valueOrDash(requisition.pr_number)}</div>
          <div className="px-2 py-2"><span className="font-semibold">Date:</span> {dateForDocument(requisition.issued_date)}</div>
        </div>

        <div className="grid grid-cols-1 border-b border-gray-700 sm:grid-cols-[2fr_1fr]">
          <div className="px-2 py-3"><span className="font-semibold">Product/ Service:</span> {valueOrDash(requisition.product_service)}</div>
          <div className="border-t border-gray-700 px-2 py-3 sm:border-l sm:border-t-0"><span className="font-semibold">Supplier:</span> {valueOrDash(requisition.supplier_name)}</div>
        </div>

        <div className="grid grid-cols-1 border-b border-gray-700 sm:grid-cols-[2fr_1fr]">
          <div className="px-2 py-3"><span className="font-semibold">Project/Department:</span> {valueOrDash(requisition.project_department || requisition.project)}</div>
          <div className="border-t border-gray-700 px-2 py-3 sm:border-l sm:border-t-0"><span className="font-semibold">ICV:</span> {valueOrDash(icv)}</div>
        </div>

        <section className="min-h-[92px] border-b border-gray-700 px-2 py-2">
          <h4 className="font-bold">1. Description and Reason for Purchase:</h4>
          <p className="mt-5 whitespace-pre-wrap">{valueOrDash(requisition.description_reason)}</p>
        </section>

        <section className="border-b border-gray-700 px-2 py-3">
          <span className="font-bold">2. Preferred Supplier (if any):</span>{' '}
          {valueOrDash(requisition.preferred_supplier_if_any || requisition.supplier_name)}
        </section>

        <section className="border-b border-gray-700">
          <div className="grid grid-cols-[2fr_0.8fr_1.3fr] border-b border-gray-700 text-center font-bold">
            <div className="px-2 py-2 text-left">3. Price</div>
            <div className="border-x border-gray-700 px-2 py-2">Total Price</div>
            <div className="px-2 py-2">Remarks</div>
          </div>
          {priceLines.length > 0 ? priceLines.map((item, index) => (
            <div key={`${item.description || item.name}-${index}`} className="grid grid-cols-[2fr_0.8fr_1.3fr] border-b border-gray-300 last:border-b-0">
              <div className="px-2 py-2">{valueOrDash(item.description || item.name)}</div>
              <div className="border-x border-gray-700 px-2 py-2 text-right font-medium">{money(item.total ?? item.total_price ?? item.amount, item.currency || requisition.currency)}</div>
              <div className="px-2 py-2">{index === 0 ? valueOrDash(item.remarks || (budget ? `Budget → AED ${Number(budget).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : requisition.price_remarks)) : valueOrDash(item.remarks)}</div>
            </div>
          )) : (
            <div className="grid grid-cols-[2fr_0.8fr_1.3fr]">
              <div className="px-2 py-2">{valueOrDash(requisition.price_description)}</div>
              <div className="border-x border-gray-700 px-2 py-2 text-right">{money(requisition.total_price, requisition.currency)}</div>
              <div className="px-2 py-2">{valueOrDash(requisition.price_remarks)}</div>
            </div>
          )}
          <div className="grid grid-cols-[2fr_0.8fr_1.3fr] border-t border-gray-700 font-bold">
            <div className="px-2 py-2">Net Total, excl VAT</div>
            <div className="border-x border-gray-700 px-2 py-2 text-right">{money(requisition.net_total_excl_vat, requisition.currency)}</div>
            <div className="px-2 py-2">
              {Number.isFinite(netTotalAed)
                ? `AED ${netTotalAed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : '—'}
            </div>
          </div>
          <div className="border-t border-gray-700 px-2 py-2">
            <span className="font-semibold">Negotiation Remarks:</span>{' '}
            <span className="whitespace-pre-wrap font-normal">{valueOrDash(negotiationRemarks)}</span>
          </div>
        </section>

        <div className="border-b border-gray-700 px-2 py-2"><span className="font-semibold">PO Reference:</span> {valueOrDash(requisition.po_number_reference)}</div>

        <section className="min-h-[150px] border-b border-gray-700 px-2 py-2">
          <h4 className="font-bold">4. Special Notes: (If any)</h4>
          <p className="mt-5 whitespace-pre-wrap">{valueOrDash(requisition.purchase_recommendation || requisition.notes)}</p>
          {metadata.attachment_reference && <p className="mt-4 font-medium underline">➜ {metadata.attachment_reference}</p>}
        </section>

        <section>
          <h4 className="border-b border-gray-700 py-1 text-center font-bold">APPROVALS</h4>
          <div className="grid grid-cols-[0.5fr_1.35fr_1fr_0.85fr_1.3fr] border-b border-gray-700 text-center font-bold">
            <div className="px-2 py-1" />
            <div className="border-x border-gray-700 px-2 py-1">Name</div>
            <div className="border-r border-gray-700 px-2 py-1">Signature</div>
            <div className="border-r border-gray-700 px-2 py-1">Status</div>
            <div className="px-2 py-1">Approval Timestamp</div>
          </div>
          {approvalRows.map(([role, name, signature, status, approvedAt], index) => {
            const approved = String(status || '').toLowerCase() === 'approved';
            const notRecorded = String(requisition.status || '').toLowerCase() === 'converted'
              && ['pending', 'in_review', 'not_recorded', ''].includes(String(status || '').toLowerCase());
            return (
              <div key={`${role}-${index}`} className="grid min-h-[38px] grid-cols-[0.5fr_1.35fr_1fr_0.85fr_1.3fr] border-b border-gray-700 last:border-b-0">
                <div className="px-2 py-2 font-semibold">{role}</div>
                <div className="border-x border-gray-700 px-2 py-2">{valueOrDash(name)}</div>
                <div className="flex items-center justify-center border-r border-gray-700 px-2 py-2">
                  {signature || approved ? <span className="inline-flex items-center gap-1 font-semibold text-emerald-700"><CheckBadgeIcon className="h-4 w-4" /> Signed</span> : <span className="text-gray-400">{notRecorded ? 'Not recorded' : 'Pending'}</span>}
                </div>
                <div className="border-r border-gray-700 px-2 py-2">{approved ? 'Approved' : notRecorded ? 'Not recorded' : valueOrDash(status)}</div>
                <div className="px-2 py-2 text-[10px]">{approved ? timestampForDocument(approvedAt) : '—'}</div>
              </div>
            );
          })}
          <div className="grid grid-cols-[0.55fr_1fr] border-t border-gray-700">
            <div className="px-2 py-2 font-semibold">Final Approval Timestamp</div>
            <div className="border-l border-gray-700 px-2 py-2">{timestampForDocument(approvalDate)}</div>
          </div>
        </section>
      </article>

      <div className="flex justify-between px-2 text-[11px] text-gray-500">
        <span>{requisition.form_reference || 'RAD-OM-PRC-0001 FRM -1 Rev 0'}</span>
        <span>{requisition.page_number || 'Page 1 of 1'}</span>
      </div>
    </div>
  );
};

PurchaseRequisitionDocumentPreview.propTypes = {
  requisition: PropTypes.object.isRequired,
  live: PropTypes.bool,
};

export default PurchaseRequisitionDocumentPreview;
