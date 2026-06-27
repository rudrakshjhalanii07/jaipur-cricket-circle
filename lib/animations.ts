"use client";

import { Variants } from "framer-motion";

/**
 * Premium Animation Constants for Jaipur Cricket Circle
 * Focused on Sports-Tech aesthetic: Sharp, Smooth, and High-Performance.
 */

export const SMOOTH_EASE = [0.16, 1, 0.3, 1] as [number, number, number, number]; // Custom cubic-bezier for premium feel
export const STAGGER_CHILDREN = 0.1;
export const VIEWPORT_CONFIG = { once: true, amount: 0.1 };

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.8, ease: SMOOTH_EASE }
  }
};

export const fadeDown: Variants = {
  hidden: { opacity: 0, y: -30 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.8, ease: SMOOTH_EASE }
  }
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: 0.8, ease: SMOOTH_EASE }
  }
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: 0.8, ease: SMOOTH_EASE }
  }
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: STAGGER_CHILDREN,
      delayChildren: 0.1
    }
  }
};

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -40 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.8, ease: SMOOTH_EASE }
  }
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 40 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.8, ease: SMOOTH_EASE }
  }
};

/**
 * Hook-style variant generator for staggered lists
 */
export const getStaggerDelay = (index: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { 
    opacity: 1, 
    y: 0, 
    transition: { 
      delay: index * 0.1,
      duration: 0.6,
      ease: SMOOTH_EASE
    } 
  }
});

/**
 * Card Reveal variant - specifically for premium cards
 */
export const cardReveal: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { duration: 0.6, ease: SMOOTH_EASE }
  }
};
