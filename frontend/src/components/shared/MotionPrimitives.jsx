import { useEffect, useState } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';

export function ScrollProgressBar() {
    const { scrollYProgress } = useScroll();
    const scaleX = useSpring(scrollYProgress, { stiffness: 180, damping: 28, restDelta: 0.001 });

    return (
        <div className="scroll-progress-track" aria-hidden="true">
            <motion.div className="scroll-progress-fill-scale" style={{ scaleX }} />
        </div>
    );
}

const DIRECTION_OFFSETS = {
    up: { y: 6, x: 0, scale: 1 },
    down: { y: -6, x: 0, scale: 1 },
    left: { x: -10, y: 0, scale: 1 },
    right: { x: 10, y: 0, scale: 1 },
    scale: { x: 0, y: 5, scale: 0.99 },
};

export function Reveal({
    children,
    delay = 0,
    direction = 'up',
    className = '',
    as = 'div',
    style,
}) {
    const MotionTag = as === 'section' ? motion.section : as === 'article' ? motion.article : motion.div;
    const offset = DIRECTION_OFFSETS[direction] || DIRECTION_OFFSETS.up;

    return (
        <MotionTag
            className={className}
            style={style}
            initial={{ opacity: 0, ...offset }}
            whileInView={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.04 }}
            transition={{
                duration: 0.42,
                delay: (Number(delay) || 0) / 1000,
                ease: [0.22, 1, 0.36, 1],
            }}
        >
            {children}
        </MotionTag>
    );
}

export function SpotlightCard({
    children,
    className = '',
    as = 'div',
    onMouseMove,
    hoverLift = true,
    ...rest
}) {
    const MotionTag = as === 'article' ? motion.article : motion.div;

    const handleMove = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`);
        e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`);
        onMouseMove?.(e);
    };

    return (
        <MotionTag
            className={`spotlight-surface ${className}`.trim()}
            onMouseMove={handleMove}
            whileHover={hoverLift ? { y: -4 } : undefined}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            {...rest}
        >
            {children}
        </MotionTag>
    );
}

export function AnimatedCounter({ value = 0, duration = 680, prefix = '', suffix = '', locale = false }) {
    const target = Number(value) || 0;
    const [display, setDisplay] = useState(target);

    useEffect(() => {
        if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
            setDisplay(target);
            return undefined;
        }
        let rafId = 0;
        const start = performance.now();
        const tick = (now) => {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            setDisplay(Math.round(target * eased));
            if (t < 1) {
                rafId = window.requestAnimationFrame(tick);
            }
        };
        rafId = window.requestAnimationFrame(tick);
        return () => window.cancelAnimationFrame(rafId);
    }, [target, duration]);

    const formatted = locale ? display.toLocaleString('en-IN') : String(display);
    return <>{`${prefix}${formatted}${suffix}`}</>;
}
