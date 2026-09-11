import React, { useState } from 'react'
import PropTypes from 'prop-types'

export default function HelpArticleBrowser({ articles, selectedArticleId }) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(selectedArticleId)
  const results = articles.filter(article => JSON.stringify(article).toLowerCase().includes(search.trim().toLowerCase()))
  const article = results.find(item => item.id === selected) || results[0]
  const control = 'rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 dark:border-slate-700 dark:bg-slate-900'
  return <div>
    <label className="block text-xs font-semibold" htmlFor="help-article-search">Search knowledge base</label>
    <input id="help-article-search" className={`${control} mt-2 h-10 w-full`} placeholder="Search topics, metrics or questions" value={search} onChange={event => setSearch(event.target.value)} />
    <nav aria-label="Help knowledge topics" className="my-4 flex flex-wrap gap-2">
      {results.map(item => <button type="button" key={item.id} className={`${control} ${article?.id === item.id ? '!border-blue-500 !bg-blue-50 !text-blue-700 dark:!bg-blue-950 dark:!text-blue-200' : ''}`} aria-current={article?.id === item.id ? 'page' : undefined} onClick={() => setSelected(item.id)}>{item.title}</button>)}
    </nav>
    {article ? <article className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900" aria-labelledby="help-article-title">
      <h3 id="help-article-title" className="text-lg font-semibold">{article.title}</h3>
      <p className="mt-2 text-sm leading-5 text-slate-600 dark:text-slate-300">{article.summary}</p>
      {article.sections.map(section => <section key={section.heading} className="mt-4">
        <h4 className="text-base font-semibold">{section.heading}</h4>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-5 text-slate-600 dark:text-slate-300">{section.steps.map(step => <li key={step}>{step}</li>)}</ul>
      </section>)}
    </article> : <p role="status">No matching guidance. Try a tab name, baseline, sessions or monthly.</p>}
  </div>
}

HelpArticleBrowser.propTypes = {
  selectedArticleId: PropTypes.string.isRequired,
  articles: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired, title: PropTypes.string.isRequired, summary: PropTypes.string.isRequired,
    sections: PropTypes.arrayOf(PropTypes.shape({heading: PropTypes.string.isRequired, steps: PropTypes.arrayOf(PropTypes.string).isRequired})).isRequired,
  })).isRequired,
}
