"use client";

// Shared motion: one easing, one rhythm, everywhere. Quiet and slow, like the brand.
import { motion, useReducedMotion, useScroll, useSpring, useTransform, type MotionProps } from "motion/react";
import { useRef, type ElementType, type ReactNode } from "react";

export const EASE = [0.22, 1, 0.36, 1] as const;

/** Fades and lifts into place the first time it scrolls into view. */
export function Reveal({ children, delay = 0, y = 28, className, as = "div" }: {
  children: ReactNode; delay?: number; y?: number; className?: string; as?: ElementType;
}) {
  const reduce = useReducedMotion();
  const Comp = motion[as as "div"] as typeof motion.div;
  return (
    <Comp
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y, filter: "blur(6px)" }}
      transition={{ duration: 0.9, ease: EASE, delay }}
      viewport={{ once: true, margin: "-12% 0px" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
    >
      {children}
    </Comp>
  );
}

/** Children appear one after another (use StaggerItem inside). */
export function Stagger({ children, className, gap = 0.09 }: { children: ReactNode; className?: string; gap?: number }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap } } }}
      viewport={{ once: true, margin: "-10% 0px" }}
      whileInView="show"
    >
      {children}
    </motion.div>
  );
}
export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={{
        hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 36, scale: 0.97 },
        show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.8, ease: EASE } },
      }}
    >
      {children}
    </motion.div>
  );
}

/** A headline whose words rise out of a mask, one by one. */
export function WordsReveal({ text, className, as = "h1", delay = 0 }: { text: string; className?: string; as?: ElementType; delay?: number }) {
  const reduce = useReducedMotion();
  const Comp = as;
  const words = text.split(" ");
  return (
    <Comp className={className} aria-label={text}>
      {words.map((w, i) => (
        <span aria-hidden className="inline-block overflow-hidden pb-[0.12em] align-bottom" key={`${w}-${i}`}>
          <motion.span
            animate={{ y: "0%", opacity: 1 }}
            className="inline-block"
            initial={reduce ? { opacity: 0 } : { y: "110%", opacity: 0 }}
            transition={{ duration: 1, ease: EASE, delay: delay + i * 0.08 }}
          >
            {w}
          </motion.span>
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </Comp>
  );
}

/** Moves slower than the page while scrolling, for depth. */
export function Parallax({ children, className, distance = 80 }: { children: ReactNode; className?: string; distance?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [distance, -distance]);
  return (
    <motion.div className={className} ref={ref} style={{ y }}>
      {children}
    </motion.div>
  );
}

/** Thin olive line across the top that fills as the page scrolls. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 });
  return <motion.div aria-hidden className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-[0%] bg-olive rtl:origin-[100%]" style={{ scaleX }} />;
}

export const fadeUp: MotionProps = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: EASE },
};
