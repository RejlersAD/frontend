/* eslint-disable react/prop-types */
import React, { useId, useRef, useState } from 'react';
import { ArrowPathIcon, ChevronRightIcon, InformationCircleIcon, MegaphoneIcon } from '@heroicons/react/24/outline';

const TABS = [{ id: 'all', label: 'All' }, { id: 'news', label: 'News' }, { id: 'updates', label: 'Updates' }, { id: 'critical', label: 'Critical' }, { id: 'urgent', label: 'Urgent' }];
const PREVIEW_SIZE = 4;
const normalized = value => typeof value === 'string' ? value.trim().toLowerCase() : '';

export function classifyWorkHubNotice(item) {
  return normalized(item?.category_name) === 'news' || normalized(item?.metadata?.notice_type) === 'news' ? 'news' : 'updates';
}

export function filterWorkHubNotices(items, tab) {
  return items.filter(item => tab === 'all' || (['critical', 'urgent'].includes(tab)
    ? normalized(item.priority) === tab : classifyWorkHubNotice(item) === tab));
}

export function prioritizeWorkHubNotices(items) {
  const ranks = { critical: 0, urgent: 1, high: 2, normal: 3, low: 4 };
  const timestamp = item => {
    const value = typeof item.created_at === 'string' ? Date.parse(item.created_at) : NaN;
    return Number.isFinite(value) ? value : -Infinity;
  };
  return [...items].sort((left, right) => (ranks[normalized(left.priority)] ?? 5) - (ranks[normalized(right.priority)] ?? 5)
    || timestamp(right) - timestamp(left));
}

function noticeDate(value) {
  if (typeof value !== 'string' || !value.trim()) return 'Date not reported';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Date not reported' : parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function WorkHubNotices({ source, onRetry, onOpenNotice, onViewAll }) {
  const [activeTab, setActiveTab] = useState('all');
  const tabs = useRef(null);
  const instanceId = useId();
  const ready = source?.state === 'ready' && Array.isArray(source.items);
  const items = ready ? source.items.filter(item => item && typeof item === 'object') : [];
  const matching = activeTab === 'all' ? prioritizeWorkHubNotices(items) : filterWorkHubNotices(items, activeTab);
  const visible = matching.slice(0, PREVIEW_SIZE);
  const unread = visible.filter(item => item.is_read === false).length;
  const unknownReadState = visible.filter(item => typeof item.is_read !== 'boolean').length;
  const navigateTabs = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const current = TABS.findIndex(tab => tab.id === activeTab);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1
      : (current + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
    setActiveTab(TABS[next].id);
    tabs.current?.querySelectorAll('[role="tab"]')[next]?.focus();
  };

  return <section className="wh-panel wh-notices-panel" aria-label="Important notices" data-testid="workhub-notices">
    <div className="wh-panel-heading"><h2><MegaphoneIcon aria-hidden="true" />Important notices</h2>
      <button type="button" className="wh-text-button" aria-label="View all notifications" onClick={() => onViewAll?.()}>View all<ChevronRightIcon aria-hidden="true" /></button></div>
    <div ref={tabs} className="wh-notice-tabs" role="tablist" aria-label="Notice categories" onKeyDown={navigateTabs}>{TABS.map(tab => <button type="button" key={tab.id}
      id={`${instanceId}-${tab.id}`} role="tab" aria-selected={activeTab === tab.id} aria-controls={`${instanceId}-notices`}
      tabIndex={activeTab === tab.id ? 0 : -1} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}</div>
    <div role="tabpanel" id={`${instanceId}-notices`} aria-labelledby={`${instanceId}-${activeTab}`} tabIndex={0}>
      {source?.state === 'loading' ? <p className="wh-panel-loading" role="status"><ArrowPathIcon aria-hidden="true" />Loading notices…</p>
        : source?.state === 'error' ? <div className="wh-panel-error" role="alert"><InformationCircleIcon aria-hidden="true" /><p>{source.message || 'Notices could not be loaded.'}</p>
          <button type="button" className="wh-text-button" onClick={() => onRetry?.()}>Retry notices</button></div>
          : !ready ? <div className="wh-panel-empty"><InformationCircleIcon aria-hidden="true" /><p>{source?.message || 'Notices are not available.'}</p></div>
            : visible.length ? <ul className="wh-notice-list" data-testid="workhub-notice-list">{visible.map((item, index) => {
              const priority = normalized(item.priority);
              const type = classifyWorkHubNotice(item);
              const category = priority === 'critical' ? 'Critical' : priority === 'urgent' ? 'Urgent' : type === 'news' ? 'News' : 'Update';
              const title = typeof item.title === 'string' && item.title.trim() ? item.title : 'Untitled notice';
              return <li key={`${item.id ?? index}-${index}`} className="wh-notice-item" data-priority={['critical', 'urgent'].includes(priority) ? priority : 'normal'}
                data-read={typeof item.is_read === 'boolean' ? String(item.is_read) : 'unknown'}>
                <button type="button" onClick={() => onOpenNotice?.(item)} aria-label={`Open notice: ${title}`}>
                  <span className="wh-notice-category" data-category={category.toLowerCase()}>{category}</span><span className="wh-notice-copy"><strong>{title}
                    {item.is_read === false && <span className="wh-notice-unread" aria-hidden="true" />}</strong>
                    {typeof item.message === 'string' && item.message.trim() && <span className="wh-notice-message">{item.message}</span>}
                    <span className="wh-notice-meta"><span>{noticeDate(item.created_at)}</span></span>
                  </span><span className="wh-notice-row-action" aria-hidden="true">{['critical', 'urgent'].includes(priority) ? 'Review' : 'View'}<ChevronRightIcon className="wh-notice-arrow" /></span>
                </button>
              </li>;
            })}</ul> : <div className="wh-panel-empty"><InformationCircleIcon aria-hidden="true" /><p>No {activeTab === 'all' ? '' : `${activeTab} `}notices in this preview.</p></div>}
    </div>
    {ready && source.message && <p className="wh-notice-coverage">{source.message}</p>}
    {ready && (source.truncated || matching.length > visible.length) && <p className="wh-notice-coverage">Showing {visible.length} of {matching.length} matching notices in the loaded preview.{source.truncated ? ' More notices may be available.' : ''}</p>}
    <div className="wh-notice-footer">{ready && <span data-testid="workhub-notice-unread-count">{unread}{unknownReadState ? ' confirmed' : ''} unread {unread === 1 ? 'notice' : 'notices'} in this preview
      {unknownReadState ? ` · ${unknownReadState} read ${unknownReadState === 1 ? 'state' : 'states'} not reported` : ''}</span>}
    </div>
  </section>;
}
