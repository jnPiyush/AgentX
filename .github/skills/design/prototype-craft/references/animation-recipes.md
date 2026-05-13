# Animation Recipes

> Companion reference to `prototype-craft/SKILL.md`. A short library of motion patterns for HTML/CSS or React + Framer Motion prototypes. Every recipe ends with a reduced-motion guard so honoring `prefers-reduced-motion: reduce` is the default, not an afterthought.

## Why these recipes exist

UX prototypes regularly need a small set of motion patterns: a page entering, a list staggering in, a card responding to hover, a section revealing on scroll. Inventing them per prototype produces inconsistent timing and frequently skipped a11y handling. These recipes give us one tuned answer for each pattern.

All recipes follow three rules:

1. Default duration is 200-280 ms. Anything longer needs a reason.
2. Easing is `cubic-bezier(0.2, 0, 0, 1)` (emphasised) or `cubic-bezier(0.4, 0, 0.2, 1)` (standard). Never linear for UI motion.
3. Every recipe MUST honor `prefers-reduced-motion: reduce` -- either via the global CSS guard from `theme-presets.md` or via a runtime check.

## Recipe 1: Page transition (Framer Motion)

```jsx
import { motion, useReducedMotion } from "framer-motion";

export function PageTransition({ children }) {
  const reduce = useReducedMotion();
  const variants = reduce
    ? { initial: { opacity: 1 }, animate: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0, transition: { duration: 0.24, ease: [0.2, 0, 0, 1] } },
      };
  return <motion.main variants={variants} initial="initial" animate="animate">{children}</motion.main>;
}
```

## Recipe 2: Staggered children entrance

```jsx
const parent = {
  initial: {},
  animate: { transition: { staggerChildren: 0.04, delayChildren: 0.06 } },
};

const child = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.4, 0, 0.2, 1] } },
};

export function CardGrid({ items }) {
  const reduce = useReducedMotion();
  const v = reduce ? { initial: {}, animate: {} } : parent;
  return (
    <motion.ul variants={v} initial="initial" animate="animate">
      {items.map((it) => (
        <motion.li key={it.id} variants={reduce ? {} : child}>{it.label}</motion.li>
      ))}
    </motion.ul>
  );
}
```

## Recipe 3: Spring hover and tap on interactive cards

```jsx
const reduce = useReducedMotion();
<motion.button
  whileHover={reduce ? undefined : { scale: 1.02 }}
  whileTap={reduce ? undefined : { scale: 0.98 }}
  transition={{ type: "spring", stiffness: 380, damping: 28 }}
>
  Open
</motion.button>
```

Keep hover lift to <= 1.03 and tap shrink to >= 0.97. Anything more reads as toy-like.

## Recipe 4: Scroll-reveal with IntersectionObserver (vanilla)

```js
function revealOnScroll(selector = "[data-reveal]") {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.querySelectorAll(selector).forEach((el) => el.classList.add("is-revealed"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("is-revealed");
          io.unobserve(e.target);
        }
      }
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
  );
  document.querySelectorAll(selector).forEach((el) => io.observe(el));
}
```

Matching CSS:

```css
[data-reveal] {
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 220ms var(--ease-emphasised), transform 220ms var(--ease-emphasised);
}
[data-reveal].is-revealed {
  opacity: 1;
  transform: translateY(0);
}
```

## Recipe 5: Skeleton shimmer (loading state)

```css
.skeleton {
  background: linear-gradient(90deg,
    var(--surface-sunken) 0%,
    var(--surface) 50%,
    var(--surface-sunken) 100%);
  background-size: 200% 100%;
  animation: shimmer 1200ms linear infinite;
}
@keyframes shimmer {
  to { background-position: -200% 0; }
}
```

The global reduced-motion guard from `theme-presets.md` collapses `animation-duration` to 0.01 ms, so the shimmer stops automatically under reduced motion.

## Recipe 6: Modal entrance and exit

```jsx
const reduce = useReducedMotion();
<motion.div
  initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.96 }}
  animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
  exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
  transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
/>
```

Pair with `AnimatePresence` and a focus trap. The focus trap is non-negotiable; see the accessibility skill.

## Recipe 7: Number count-up

```jsx
import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

export function CountUp({ to, durationMs = 600 }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? to : 0);
  useEffect(() => {
    if (reduce) { setN(to); return; }
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / durationMs);
      setN(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, durationMs, reduce]);
  return <span>{n.toLocaleString()}</span>;
}
```

## Recipe 8: Pulse for "live" indicators

```css
.pulse-dot {
  position: relative;
}
.pulse-dot::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  box-shadow: 0 0 0 0 var(--brand);
  animation: pulse 1.6s var(--ease-emphasised) infinite;
}
@keyframes pulse {
  0%   { box-shadow: 0 0 0 0   var(--brand); opacity: 0.6; }
  70%  { box-shadow: 0 0 0 12px transparent; opacity: 0; }
  100% { box-shadow: 0 0 0 0   transparent; opacity: 0; }
}
```

Reduced-motion guard collapses the pulse to a static dot.

## Bad smells

| Pattern | Why it is wrong | Fix |
|---------|-----------------|-----|
| Linear easing on UI motion | Reads as mechanical | Use `var(--ease-emphasised)` |
| Duration > 400 ms on micro-interactions | Feels sluggish | Cap at 280 ms |
| Bouncy springs on form controls | Unprofessional | Reserve for delight surfaces |
| Looping animation without reduced-motion fallback | Vestibular harm | Use the global guard or branch on `useReducedMotion` |
| Animating `width`/`height`/`top`/`left` | Layout thrash | Animate `transform` and `opacity` |
| Auto-playing video or carousels | a11y + perf | Require explicit user action |

## Composition

- Pair recipes 1 + 2 for a feed or dashboard page.
- Pair recipe 4 with a long marketing page; do not use it on dashboards where the data must appear instantly.
- Recipes 5 and 8 must respect the reduced-motion guard from `theme-presets.md`.