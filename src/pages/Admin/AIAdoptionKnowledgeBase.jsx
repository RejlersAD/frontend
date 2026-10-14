import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { BookOpen, Search, X, ArrowRight } from 'lucide-react';
import { adoptionKnowledge } from './aiAdoptionKnowledge';
import './AIAdoptionHelp.css';

export default function AIAdoptionKnowledgeBase({ tab, onNavigate }) {
  const dialog = useRef(null);
  const [topic, setTopic] = useState(tab);
  const [search, setSearch] = useState('');
  useEffect(() => { setTopic(adoptionKnowledge.some(r => r.id === tab) ? tab : 'quality'); }, [tab]);
  const open = () => { setSearch(''); dialog.current?.showModal(); };
  const results = adoptionKnowledge.filter(row => JSON.stringify(row).toLowerCase().includes(search.trim().toLowerCase()));
  const article = results.find(row => row.id === topic) || results[0];
  return <><button onClick={open} className="ad-knowledge-trigger"><BookOpen /> Knowledge base</button>
    <dialog ref={dialog} className="ak-dialog" aria-labelledby="ad-knowledge-title" onClick={event => { if (event.target === dialog.current) dialog.current.close(); }}>
      <div className="ak-shell"><header><div><h2 id="ad-knowledge-title"><BookOpen /> AI Adoption knowledge base</h2><p>Guidance for all ten views · definitions, workflows and reporting boundaries</p></div><button aria-label="Close knowledge base" onClick={() => dialog.current.close()}><X /></button></header>
        <label className="ak-search"><Search /><input autoFocus aria-label="Search knowledge base" placeholder="Search a topic, metric or question" value={search} onChange={e => setSearch(e.target.value)} /></label>
        <div className="ak-layout"><nav aria-label="Knowledge base topics">{results.map(row => <button key={row.id} aria-current={article?.id === row.id ? 'page' : undefined} onClick={() => setTopic(row.id)}>{row.title}</button>)}</nav>
          {article ? <article key={article.id}><h3>{article.title}</h3><p>{article.purpose}</p><h4>How to use this view</h4><ol>{article.steps.map(step => <li key={step}>{step}</li>)}</ol><h4>Metrics and definitions</h4><ul>{article.metrics.map(item => <li key={item}>{item}</li>)}</ul><h4>Important boundaries</h4><ul>{article.limits.map(item => <li key={item}>{item}</li>)}</ul><h4>Common questions</h4>{article.faq.map(item => <p key={item}>{item}</p>)}<button className="ak-open" onClick={() => { onNavigate(article.id); dialog.current.close(); }}>Open {article.title}<ArrowRight /></button></article> : <p role="status">No matching guidance. Try “sessions”, “baseline”, “monthly” or a tab name.</p>}
        </div></div>
    </dialog></>;
}
AIAdoptionKnowledgeBase.propTypes = { tab: PropTypes.string.isRequired, onNavigate: PropTypes.func.isRequired };
