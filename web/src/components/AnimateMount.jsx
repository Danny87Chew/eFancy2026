import React, { useState, useEffect, useRef } from 'react';

const animations = {
  fadeIn: 'animate-fadeIn',
  fadeInUp: 'animate-fadeInUp',
  fadeInDown: 'animate-fadeInDown',
  fadeInScale: 'animate-fadeInScale',
  slideUp: 'animate-slideUp',
  slideDown: 'animate-slideDown',
  scaleIn: 'animate-scaleIn',
};

export default function AnimateMount({ children, animation = 'fadeInUp', duration = 350, delay = 0, style, className = '' }) {
  const [mounted, setMounted] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  const animClass = animations[animation] || 'animate-fadeInUp';

  return (
    <div
      ref={ref}
      className={`${className} ${mounted ? animClass : 'animate-hidden'}`}
      style={{
        ...style,
        animationDuration: `${duration}ms`,
        animationFillMode: 'both',
      }}
    >
      {children}
    </div>
  );
}