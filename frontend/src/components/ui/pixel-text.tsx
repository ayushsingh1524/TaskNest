"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface PixelTextProps {
  text: string;
  className?: string;
  forceHover?: boolean;
}

export function PixelText({ text, className, forceHover }: PixelTextProps) {
  const [internalHover, setInternalHover] = useState(false);
  const isHovered = forceHover !== undefined ? forceHover : internalHover;

  return (
    <motion.div
      className={cn("relative flex items-center overflow-hidden", className)}
      onMouseEnter={() => setInternalHover(true)}
      onMouseLeave={() => setInternalHover(false)}
      initial={false}
      animate={{ 
        width: isHovered ? "auto" : 0, 
        opacity: isHovered ? 1 : 0
      }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="whitespace-nowrap relative inline-block pl-2">
        <span className="relative z-10">{text}</span>
        
        {/* Cyan/Blue Glitch Layer */}
        <motion.span
          className="absolute top-0 left-0 z-0 text-[var(--color-fauna-blue)] opacity-70 select-none pl-2"
          animate={
            isHovered
              ? {
                  x: [-3, 3, -2, 2, 0],
                  y: [1, -1, 2, -2, 0],
                  clipPath: [
                    "inset(10% 0 80% 0)",
                    "inset(60% 0 10% 0)",
                    "inset(30% 0 50% 0)",
                    "inset(80% 0 5% 0)",
                    "inset(0 0 0 0)",
                  ],
                }
              : { x: 0, y: 0, clipPath: "inset(0 0 0 0)" }
          }
          transition={{ duration: 0.5, ease: "anticipate" }}
          aria-hidden="true"
        >
          {text}
        </motion.span>
        
        {/* Primary/Red Glitch Layer */}
        <motion.span
          className="absolute top-0 left-0 z-0 text-primary opacity-70 select-none pl-2"
          animate={
            isHovered
              ? {
                  x: [3, -3, 2, -2, 0],
                  y: [-1, 1, -2, 2, 0],
                  clipPath: [
                    "inset(80% 0 10% 0)",
                    "inset(10% 0 60% 0)",
                    "inset(50% 0 30% 0)",
                    "inset(5% 0 80% 0)",
                    "inset(0 0 0 0)",
                  ],
                }
              : { x: 0, y: 0, clipPath: "inset(0 0 0 0)" }
          }
          transition={{ duration: 0.5, ease: "anticipate" }}
          aria-hidden="true"
        >
          {text}
        </motion.span>

        {/* Pixel Blocks that flash briefly on hover */}
        <AnimatePresence>
          {isHovered && (
            <motion.div 
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 z-20 grid grid-cols-4 grid-rows-2 pointer-events-none mix-blend-overlay pl-2"
            >
              {Array.from({ length: 8 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="bg-foreground"
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 0 }}
                  transition={{
                    duration: 0.3,
                    delay: ((i * 37) % 8) * 0.025,
                  }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
