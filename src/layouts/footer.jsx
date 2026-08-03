import { Globe } from "lucide-react";

export const Footer = () => {
    return (
        <footer className="flex flex-wrap items-center justify-between gap-4 pt-4">
            <p className="text-base text-center font-medium text-slate-900 dark:text-slate-50">
                © 2025 Rejlers. All Rights Reserved
            </p>
            <div className="flex flex-wrap gap-x-6 items-center">
                <a
                    href="https://www.linkedin.com/company/rejlers/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link flex items-center gap-1"
                    aria-label="Rejlers LinkedIn"
                >
                    <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24" className="text-blue-700 dark:text-blue-400">
                        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-10h3v10zm-1.5-11.268c-.966 0-1.75-.784-1.75-1.75s.784-1.75 1.75-1.75 1.75.784 1.75 1.75-.784 1.75-1.75 1.75zm15.5 11.268h-3v-5.604c0-1.337-.026-3.063-1.868-3.063-1.868 0-2.154 1.459-2.154 2.967v5.7h-3v-10h2.881v1.367h.041c.401-.761 1.379-1.563 2.841-1.563 3.041 0 3.603 2.002 3.603 4.604v5.592z"/>
                    </svg>
                  
                </a>
                <a
                    href="https://www.rejlers.com/ae/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link flex items-center gap-1"
                    aria-label="Rejlers Website"
                >
                    <Globe size={18} className="text-green-700 dark:text-green-400" />
                  
                </a>
                {/* Add more social links as needed */}
            </div>
        </footer>
    );
};
