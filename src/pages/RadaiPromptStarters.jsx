import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { ArrowRight, Sparkles, Star } from "lucide-react";
import { skillIcon, skillTone } from "./radaiSkillVisuals";

// RADAI Intelligence prompt starters: skills ranked for what the user is doing right now.
// Favourites (starred) and usage counts live in this browser only.
const FAV_KEY = "radai.intelligence.favouriteSkills";
const USE_KEY = "radai.intelligence.skillUse";
const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const writeJson = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable: keep in memory */ } };

export const recordSkillUse = (skillId) => {
  if (!skillId) return;
  const counts = readJson(USE_KEY, {});
  counts[skillId] = (counts[skillId] || 0) + 1;
  writeJson(USE_KEY, counts);
};

// Why a skill fits right now: [score, reason]. Higher scores come first.
function contextReasons(skill, ctx) {
  const reasons = [];
  const names = ctx.fileNames.map((n) => n.toLowerCase());
  const has = (re) => names.some((n) => re.test(n));
  if (skill.id === "line_list_check" && has(/line.?list/)) reasons.push([60, "Fits your attached line list"]);
  if (skill.id === "crs_response" && has(/crs|comment/)) reasons.push([60, "Fits your attached comment sheet"]);
  if (skill.id === "pid_review" && has(/p&?id|pid/)) reasons.push([55, "Fits your attached P&ID"]);
  if (skill.id === "revision_compare" && ctx.fileNames.length >= 2) reasons.push([50, "You attached several files"]);
  if (skill.id === "tender_gap" && has(/tender|itb|rfq|enquiry|scope/)) reasons.push([50, "Fits your attached tender"]);
  if (skill.id === "executive_summary" && ctx.fileNames.length === 1) reasons.push([35, "Summarise your attached file"]);
  if (ctx.projectName && ["handover_questions", "risk_register", "pid_review", "tag_consistency"].includes(skill.id)) {
    reasons.push([25, `For ${ctx.projectName}`]);
  }
  if (ctx.inConversation && ["executive_summary", "meeting_minutes", "email_reply", "technical_query"].includes(skill.id)) {
    reasons.push([20, "Turn this chat into a deliverable"]);
  }
  return reasons.sort((a, b) => b[0] - a[0])[0] || null;
}

export default function RadaiPromptStarters({ skills, activeSkillId, projectName, fileNames, inConversation, onPick, onBrowse }) {
  const [tab, setTab] = useState("suggested");
  const [favourites, setFavourites] = useState(() => readJson(FAV_KEY, []));
  const uses = readJson(USE_KEY, {});

  const ranked = useMemo(() => {
    const ctx = { projectName, fileNames, inConversation };
    return skills.map((skill) => {
      const reason = contextReasons(skill, ctx);
      const used = uses[skill.id] || 0;
      const fav = favourites.includes(skill.id);
      const score = (reason?.[0] || 0) + Math.min(used, 10) * 3 + (fav ? 15 : 0) + (skill.custom && skill.editable ? 5 : 0);
      const why = reason?.[1] || (fav ? "Your favourite" : used ? `Used ${used}×` : skill.custom ? (skill.editable ? "Your skill" : `Shared by ${skill.owner_name || "a colleague"}`) : "");
      return { skill, score, why, fav };
    }).sort((a, b) => b.score - a.score);
  }, [skills, projectName, fileNames, inConversation, favourites, uses]);

  const toggleFavourite = (id) => {
    const next = favourites.includes(id) ? favourites.filter((x) => x !== id) : [...favourites, id];
    setFavourites(next);
    writeJson(FAV_KEY, next);
  };

  if (!skills.length) return null;

  // In a conversation: one compact row of the best follow-ups.
  if (inConversation) {
    return (
      <section className="radai-ai-prompt-starters" aria-label="Suggested skills">
        <div className="radai-ai-prompt-list">
          {ranked.slice(0, 6).map(({ skill, why }) => {
            const Icon = skillIcon(skill);
            return (
              <button type="button" key={skill.id} onClick={() => onPick(skill)} title={why || skill.description}
                className={`radai-ai-prompt-chip ${activeSkillId === skill.id ? "!border-[var(--ai-focus)] !bg-[var(--ai-soft)]" : ""}`}>
                <Icon size={15} aria-hidden="true" />{skill.name}
              </button>
            );
          })}
          <button type="button" onClick={onBrowse} className="radai-ai-prompt-chip"><Sparkles size={15} aria-hidden="true" />All skills</button>
        </div>
      </section>
    );
  }

  const list = tab === "favourites" ? ranked.filter((r) => r.fav) : tab === "all" ? [...ranked].sort((a, b) => a.skill.name.localeCompare(b.skill.name)) : ranked.slice(0, 6);

  return (
    <section className="radai-ai-prompt-starters radai-ai-starters" aria-labelledby="radai-ai-prompt-starters-title">
      <div className="radai-ai-starters-head">
        <h2 id="radai-ai-prompt-starters-title">Start with a skill</h2>
        <div className="radai-ai-starters-tabs" role="tablist" aria-label="Prompt starters">
          {[["suggested", "Suggested"], ["favourites", `Favourites${favourites.length ? ` ${favourites.length}` : ""}`], ["all", "All"]].map(([id, text]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={tab === id ? "is-active" : ""}>{text}</button>
          ))}
        </div>
        <button type="button" onClick={onBrowse} className="radai-ai-starters-browse">Browse and create skills<ArrowRight size={13} /></button>
      </div>
      {tab === "favourites" && !list.length ? (
        <p className="radai-ai-starters-empty">Star a skill to keep it here. Favourites are saved in this browser.</p>
      ) : (
        <ul className="radai-ai-starter-grid">
          {list.map(({ skill, why, fav }) => {
            const Icon = skillIcon(skill);
            return (
              <li key={skill.id} className={`radai-ai-starter-card ${activeSkillId === skill.id ? "is-active" : ""}`}>
                <button type="button" className="radai-ai-starter-main" onClick={() => onPick(skill)}>
                  <span className={`radai-ai-starter-icon bg-gradient-to-br ${skillTone(skill)}`}><Icon size={15} aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="radai-ai-starter-name">{skill.name}</span>
                    <span className="radai-ai-starter-desc">{skill.description}</span>
                    {why && <span className="radai-ai-starter-why">{why}</span>}
                  </span>
                </button>
                <button type="button" className={`radai-ai-starter-star ${fav ? "is-on" : ""}`} onClick={() => toggleFavourite(skill.id)}
                  aria-pressed={fav} aria-label={fav ? `Remove ${skill.name} from favourites` : `Add ${skill.name} to favourites`} title={fav ? "Remove from favourites" : "Add to favourites"}>
                  <Star size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

RadaiPromptStarters.propTypes = {
  skills: PropTypes.arrayOf(PropTypes.object).isRequired, activeSkillId: PropTypes.string, projectName: PropTypes.string,
  fileNames: PropTypes.arrayOf(PropTypes.string).isRequired, inConversation: PropTypes.bool,
  onPick: PropTypes.func.isRequired, onBrowse: PropTypes.func.isRequired,
};
