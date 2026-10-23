"use client";

import { useState, useEffect, type FC } from "react";
import { motion, LayoutGroup } from "motion/react";

/* ---------- Types ---------- */
interface TabItem {
    id: string;
    label: string;
}

interface ContinuousTabsProps {
    tabs?: TabItem[];
    defaultActiveId?: string;
    /** Maskati: controlled active tab (e.g. from the URL). */
    activeId?: string;
    onChange?: (id: string) => void;
    /** Maskati: unique per tab bar, so two bars on one page animate separately. */
    layoutId?: string;
    className?: string;
}

/* ---------- Defaults ---------- */
const DEFAULT_TABS: TabItem[] = [
    { id: "home", label: "Home" },
    { id: "interactions", label: "Interactions" },
    { id: "resources", label: "Resources" },
    { id: "docs", label: "Docs" },
];

export const ContinuousTabs: FC<ContinuousTabsProps> = ({
    tabs = DEFAULT_TABS,
    defaultActiveId = "home",
    activeId,
    onChange,
    layoutId = "active-pill",
    className = "",
}) => {
    const [ownActive, setOwnActive] = useState<string>(defaultActiveId);
    const active = activeId ?? ownActive;
    const [isMounted, setIsMounted] = useState<boolean>(false);

    useEffect(() => {
        requestAnimationFrame(() => setIsMounted(true));
    }, []);

    const handleChange = (id: string) => {
        setOwnActive(id);
        onChange?.(id);
    };

    if (!isMounted) return <div className="h-12" aria-hidden />;

    return (
        <LayoutGroup id={layoutId}>
            <nav
                role="tablist"
                className={`
          relative inline-flex max-w-full flex-wrap items-center gap-0.5 sm:gap-1 p-1 sm:p-1.5
            rounded-full
            border border-line
            bg-linear-to-b from-surface-raised to-surface-tile
            shadow-[inset_0_-2px_4px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.9),0_4px_12px_rgba(0,0,0,0.03)]
            dark:shadow-[inset_0_-2px_4px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.05),0_10px_20px_rgba(0,0,0,0.4)]
            transition-all duration-300 ${className}
          `}
            >
                {tabs.map((tab) => {
                    const isActive = active === tab.id;

                    return (
                        <button
                            key={tab.id}
                            role="tab"
                            aria-selected={isActive}
                            type="button"
                            onClick={() => handleChange(tab.id)}
                            className="relative px-4 py-2 sm:px-6 sm:py-2.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            {/* Active pill */}
                            {isActive && (
                                <motion.div
                                    layoutId={layoutId}
                                    transition={{
                                        type: "spring",
                                        stiffness: 380,
                                        damping: 30,
                                        mass: 0.9,
                                    }}
                                    className="absolute inset-0 rounded-full bg-action shadow-xs"
                                />
                            )}

                            {/* Text */}
                            <motion.span
                                layout="position"
                                className={`relative z-10 text-sm sm:text-base font-semibold transition-colors duration-200
                    ${isActive ? "text-on-action" : "text-ink-muted hover:text-ink"}
                  `}
                            >
                                {tab.label}
                            </motion.span>
                        </button>
                    );
                })}
            </nav>
        </LayoutGroup>
    );
};
