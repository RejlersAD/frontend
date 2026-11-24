import {
  BookOpen, ClipboardList, FileText, GitCompare, HelpCircle, ListChecks, Mail, MessageSquare, Pencil, SearchCheck,
  ShieldAlert, Sparkles, Tags, Workflow,
} from "lucide-react";

// Shared look for skills (Skills dialog and prompt starters). Icons must exist in lucide-react 0.263.
export const SKILL_ICONS = {
  workflow: Workflow, "list-checks": ListChecks, "git-compare": GitCompare, "message-square-reply": MessageSquare,
  tags: Tags, "shield-alert": ShieldAlert, "search-check": SearchCheck, "circle-help": HelpCircle,
  "notebook-pen": Pencil, "clipboard-list": ClipboardList, "file-text": FileText, mail: Mail, sparkles: Sparkles,
};
export const SKILL_TONES = {
  Engineering: "from-violet-500 to-indigo-700", Documents: "from-sky-500 to-blue-700",
  Commercial: "from-amber-500 to-orange-600", Communication: "from-emerald-500 to-teal-700", Custom: "from-fuchsia-500 to-purple-700",
};
export const skillIcon = (skill) => SKILL_ICONS[skill?.icon] || BookOpen;
export const skillTone = (skill) => SKILL_TONES[skill?.custom ? "Custom" : skill?.category] || SKILL_TONES.Engineering;
