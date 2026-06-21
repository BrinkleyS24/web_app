import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from "framer-motion";

// Mouse-reactive 3D tilt with a cursor-following glare. Wrap any card; the
// parent needs perspective (e.g. `[perspective:1200px]`). Fully disabled under
// prefers-reduced-motion.
export default function TiltCard({ children, className = "", max = 6, glare = true }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rx = useSpring(useTransform(my, [0, 1], [max, -max]), { stiffness: 200, damping: 22, mass: 0.5 });
  const ry = useSpring(useTransform(mx, [0, 1], [-max, max]), { stiffness: 200, damping: 22, mass: 0.5 });
  const glareBg = useTransform(
    [mx, my],
    ([gx, gy]) =>
      `radial-gradient(360px circle at ${gx * 100}% ${gy * 100}%, rgba(47,190,143,0.18), transparent 60%)`,
  );

  function onMove(e) {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  }
  function reset() {
    mx.set(0.5);
    my.set(0.5);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      style={reduce ? undefined : { rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
      className={`group relative ${className}`}
    >
      {children}
      {glare && !reduce ? (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: glareBg }}
        />
      ) : null}
    </motion.div>
  );
}
