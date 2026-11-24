import { useCallback, useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'
import { Share2, Trash2, Users } from 'lucide-react'
import {
  enterpriseError, getEnterpriseContext, getTeam, shareWorkspace, unshareWorkspace, updateSharedWorkspace,
} from '../services/enterprise.service'

// Team & Enterprise: share an AI project with whole teams from inside RADAI Intelligence.
// The API enforces every rule (owner-only sharing, team linker roles, edition); this only decides what to show.
const FLAG_ON = import.meta.env.VITE_ENABLE_ENTERPRISE_TEAMS === 'true'
const TEAM_EDITIONS = ['team', 'enterprise']

// Opens the Teams & Governance section of RADAI Intelligence: in place when the host page
// provides a handler, otherwise through the page address.
function TeamsLink({ onOpen, className, children }) {
  if (onOpen) return <button type="button" onClick={onOpen} className={className}>{children}</button>
  return <Link to="/radai-intelligence?view=teams" className={className}>{children}</Link>
}
TeamsLink.propTypes = { onOpen: PropTypes.func, className: PropTypes.string, children: PropTypes.node }


export default function RadaiTeamShare({ project, onChanged, onManageTeams }) {
  const [state, setState] = useState({ status: 'loading', teams: [], shared: [] })
  const [teamId, setTeamId] = useState('')
  const [role, setRole] = useState('viewer')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async signal => {
    const ctx = await getEnterpriseContext(signal)
    if (!ctx?.enabled) return { status: 'off', teams: [], shared: [] }
    if (!TEAM_EDITIONS.includes(ctx.edition?.effective_edition)) return { status: 'edition', teams: [], shared: [] }
    const teams = (ctx.teams || []).filter(team => team.can_link)
    const details = await Promise.all(teams.map(team => getTeam(team.id).catch(() => null)))
    const shared = details.filter(Boolean).flatMap(team => (team.workspaces || [])
      .filter(row => String(row.workspace_id) === String(project.id))
      .map(row => ({ ...row, team_id: team.id, team_name: team.name })))
    return { status: 'ready', teams, shared }
  }, [project.id])

  useEffect(() => {
    if (!FLAG_ON) return undefined
    const controller = new AbortController()
    load(controller.signal)
      .then(next => { if (!controller.signal.aborted) setState(next) })
      .catch(() => { if (!controller.signal.aborted) setState({ status: 'error', teams: [], shared: [] }) })
    return () => controller.abort()
  }, [load])

  if (!FLAG_ON || state.status === 'off') return null

  const run = async (operation, message) => {
    setBusy(true); setError(''); setNotice('')
    try {
      await operation()
      setState(await load())
      await onChanged?.()
      setNotice(message)
    } catch (err) {
      setError(enterpriseError(err))
    } finally {
      setBusy(false)
    }
  }

  const available = state.teams.filter(team => !state.shared.some(row => row.team_id === team.id))
  const share = event => {
    event.preventDefault()
    if (!teamId) return
    run(async () => { await shareWorkspace(teamId, { workspace_id: project.id, role }); setTeamId('') },
      'Shared with the team. Its members now have access.')
  }

  return <div className="space-y-3 rounded-xl border border-[var(--rd-border-soft)] p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 font-semibold"><Share2 size={16} aria-hidden="true" />Share with a team</h2>
      <TeamsLink onOpen={onManageTeams} className="text-xs underline text-[var(--rd-text-muted)]">Manage teams</TeamsLink>
    </div>
    <p className="text-xs text-[var(--rd-text-muted)]">Everyone in the team gets access to this project’s knowledge and instructions. People who join or leave the team are updated automatically. Conversations stay private.</p>
    {state.status === 'loading' && <p className="text-xs" role="status">Loading teams…</p>}
    {state.status === 'error' && <p className="text-xs text-[var(--rd-danger)]" role="alert">Teams could not be loaded. Try again later.</p>}
    {state.status === 'edition' && <p className="text-xs text-[var(--rd-text-muted)]">Team sharing needs the Team or Enterprise edition. Ask your platform administrator to upgrade on <TeamsLink onOpen={onManageTeams} className="underline">Teams &amp; Governance</TeamsLink>.</p>}
    {error && <p className="text-xs text-[var(--rd-danger)]" role="alert">{error}</p>}
    {notice && <p className="text-xs" role="status">{notice}</p>}
    {state.status === 'ready' && <>
      {state.shared.length > 0 && <ul className="divide-y divide-[var(--rd-border-soft)] border-y border-[var(--rd-border-soft)]">
        {state.shared.map(row => <li key={row.team_id} className="flex items-center gap-3 py-2">
          <Users size={16} aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate font-medium">{row.team_name}</span>
          <label className="sr-only" htmlFor={`team-role-${row.team_id}`}>Access for {row.team_name}</label>
          <select id={`team-role-${row.team_id}`} value={row.role} disabled={busy} className="rd-input !w-auto shrink-0"
            onChange={event => run(() => updateSharedWorkspace(row.team_id, project.id, { role: event.target.value }), 'Team access updated.')}>
            <option value="viewer">Viewer</option><option value="editor">Editor</option>
          </select>
          <button type="button" disabled={busy} aria-label={`Stop sharing with ${row.team_name}`}
            className="shrink-0" onClick={() => run(() => unshareWorkspace(row.team_id, project.id), 'No longer shared with the team.')}><Trash2 size={16} /></button>
        </li>)}
      </ul>}
      {state.teams.length === 0
        ? <p className="text-xs text-[var(--rd-text-muted)]">You are not a team admin or lead engineer in any team. <TeamsLink onOpen={onManageTeams} className="underline">Create or join a team</TeamsLink> to share this project.</p>
        : available.length === 0
          ? <p className="text-xs text-[var(--rd-text-muted)]">Shared with every team you can share to.</p>
          : <form onSubmit={share} className="flex flex-wrap items-center gap-2">
            <label htmlFor="ai-team-share" className="sr-only">Team</label>
            <select id="ai-team-share" value={teamId} onChange={event => setTeamId(event.target.value)} className="rd-input min-w-0 flex-1">
              <option value="">Choose a team</option>
              {available.map(team => <option key={team.id} value={team.id}>{team.name} · {team.member_count} member{team.member_count === 1 ? '' : 's'}</option>)}
            </select>
            <label htmlFor="ai-team-role" className="sr-only">Team access</label>
            <select id="ai-team-role" value={role} onChange={event => setRole(event.target.value)} className="rd-input !w-auto shrink-0">
              <option value="viewer">Viewer</option><option value="editor">Editor</option>
            </select>
            <button type="submit" disabled={busy || !teamId} className="rd-btn rd-btn-primary"><Share2 size={16} />Share</button>
          </form>}
    </>}
  </div>
}

RadaiTeamShare.propTypes = { project: PropTypes.object.isRequired, onChanged: PropTypes.func, onManageTeams: PropTypes.func }
