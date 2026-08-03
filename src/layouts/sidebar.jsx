import { forwardRef } from "react";
import { NavLink } from "react-router-dom";
import { navbarLinks } from "@/constants";
import { sidebarLinks } from "@/constants/sidebarLinks";
import PropTypes from "prop-types";
import Assets from "../assets/Assets";
import { cn } from "../utils";

export const Sidebar = forwardRef(({ collapsed }, ref) => {
    return (
        <aside
            ref={ref}
            className={cn(
                "fixed z-[100] flex h-full w-[240px] flex-col overflow-x-hidden border-r border-slate-300 bg-gradient-to-b from-blue-50 via-white to-slate-100 shadow-xl [transition:_width_300ms_cubic-bezier(0.4,_0,_0.2,_1),_left_300ms_cubic-bezier(0.4,_0,_0.2,_1),_background-color_150ms_cubic-bezier(0.4,_0,_0.2,_1),_border_150ms_cubic-bezier(0.4,_0,_0.2,_1)] dark:border-slate-700 dark:bg-gradient-to-b dark:from-slate-900 dark:via-slate-800 dark:to-slate-900",
                collapsed ? "md:w-[70px] md:items-center" : "md:w-[240px]",
                collapsed ? "max-md:-left-full" : "max-md:left-0",
            )}
        >
            <NavLink to="/" className="block" reloadDocument>
                <div className="flex gap-x-3 p-3 items-center cursor-pointer">
                    <img
                        src={Assets.logoLight}
                        alt="Logoipsum"
                        className="dark:hidden drop-shadow-md w-8 h-8 rounded-full"
                    />
                    <img
                        src={Assets.logo_dark}
                        alt="Logoipsum"
                        className="hidden dark:block drop-shadow-md w-8 h-8 rounded-full"
                    />
                    {!collapsed && (
                        <p className="text-lg font-bold text-[#0d0d37e4] transition-colors dark:text-slate-200 tracking-wide">
                            Rejlers QHSE
                        </p>
                    )}
                </div>
            </NavLink>
            <div className="flex w-full flex-col gap-y-4 overflow-y-auto overflow-x-hidden p-3 [scrollbar-width:_thin]">
                {sidebarLinks.map((navbarLink, idx) => (
                    <nav
                        key={navbarLink.title}
                        className={cn("sidebar-group", collapsed && "md:items-center")}
                    >
                        {!collapsed && (
                            <p
                                className={cn(
                                    "sidebar-group-title mb-2 font-semibold text-slate-700 dark:text-slate-200 tracking-wider uppercase text-xs"
                                )}
                            >
                                {navbarLink.title}
                            </p>
                        )}
                        <div className="space-y-1">
                        {navbarLink.links.map((link) => (
                            <NavLink
                                key={link.label}
                                to={link.path}
                                className={({ isActive }) =>
                                    cn(
                                        "sidebar-item flex items-center gap-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group",
                                        "hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-900 dark:hover:text-blue-200",
                                        isActive
                                            ? "bg-blue-200 text-blue-900 dark:bg-blue-800 dark:text-blue-100 shadow"
                                            : "text-slate-700 dark:text-slate-200"
                                    )
                                }
                            >
                                <span className={cn(
                                    "flex-shrink-0 transition-transform duration-200 group-hover:scale-110",
                                    link.iconColor // <-- Add color class from sidebarLinks
                                )}>
                                    <link.icon size={22} />
                                </span>
                                {!collapsed && <p className="whitespace-nowrap">{link.label}</p>}
                            </NavLink>
                        ))}
                        </div>
                        {idx < sidebarLinks.length - 1 && (
                            <hr className="my-3 border-t border-slate-200 dark:border-slate-700 opacity-50" />
                        )}
                    </nav>
                ))}
            </div>
        </aside>
    );
});

Sidebar.displayName = "Sidebar";

Sidebar.propTypes = {
    collapsed: PropTypes.bool,
};
