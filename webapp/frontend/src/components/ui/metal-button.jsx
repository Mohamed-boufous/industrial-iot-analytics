import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "./button";
import { cn } from "../../lib/utils";

/**
 * MetalButton : Bouton interactif moderne avec micro-animations Framer Motion.
 * 
 * - 100% robuste, zéro dépendance WebGL, zéro crash, zéro erreur console.
 * - Préserve les couleurs, bordures lumineuses et styles des presets (chromatic, gold, silver).
 * - Adaptation automatique aux thèmes Dark et Light avec effet glassmorphism.
 */
export const MetalButton = React.forwardRef(function MetalButton(
  {
    children,
    className,
    variant = "outline",
    size = "default",
    preset = "chromatic",
    borderRadius = 14,
    metalFxStyle = {},
    style = {},
    onClick,
    disabled = false,
    ...props
  },
  ref
) {
  const [isDark, setIsDark] = React.useState(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains("dark") || localStorage.getItem("theme") === "dark";
    }
    return true;
  });

  React.useEffect(() => {
    if (typeof document === "undefined") return;

    const updateTheme = () => {
      const dark = document.documentElement.classList.contains("dark") || localStorage.getItem("theme") === "dark";
      setIsDark(dark);
    };

    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    window.addEventListener("storage", updateTheme);

    return () => {
      observer.disconnect();
      window.removeEventListener("storage", updateTheme);
    };
  }, []);

  // Définition des styles par défaut selon le preset
  const presetStyles = {
    chromatic: {
      bg: isDark ? "rgba(34, 197, 94, 0.16)" : "rgba(34, 197, 94, 0.12)",
      border: "1px solid rgba(34, 197, 94, 0.5)",
      shadow: "0 4px 18px rgba(34, 197, 94, 0.22)"
    },
    silver: {
      bg: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.04)",
      border: "1px solid var(--azura-border)",
      shadow: isDark ? "0 4px 14px rgba(0, 0, 0, 0.25)" : "0 2px 8px rgba(0, 0, 0, 0.04)"
    },
    gold: {
      bg: isDark ? "rgba(239, 68, 68, 0.16)" : "rgba(239, 68, 68, 0.12)",
      border: "1px solid rgba(239, 68, 68, 0.5)",
      shadow: "0 4px 18px rgba(239, 68, 68, 0.22)"
    }
  };

  const currentPreset = presetStyles[preset] || presetStyles.chromatic;

  const effectiveBg = metalFxStyle.backgroundColor || currentPreset.bg;
  const effectiveBorder = metalFxStyle.border || currentPreset.border;
  const effectiveShadow = metalFxStyle.boxShadow || currentPreset.shadow;
  const effectiveRadius = typeof metalFxStyle.borderRadius === "number"
    ? `${metalFxStyle.borderRadius}px`
    : (metalFxStyle.borderRadius || `${borderRadius}px`);

  return (
    <motion.div
      whileHover={{ scale: disabled ? 1 : 1.025 }}
      whileTap={{ scale: disabled ? 1 : 0.975 }}
      transition={{ type: "spring", stiffness: 450, damping: 25 }}
      className={cn("inline-flex items-center justify-center select-none", className)}
      style={{
        borderRadius: effectiveRadius,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        ...style
      }}
    >
      <Button
        ref={ref}
        variant={variant}
        size={size}
        disabled={disabled}
        onClick={onClick}
        className={cn(
          "relative transition-all font-semibold tracking-wide !h-auto border-0 flex items-center justify-center",
          className
        )}
        style={{
          borderRadius: effectiveRadius,
          backgroundColor: effectiveBg,
          border: effectiveBorder,
          boxShadow: effectiveShadow,
          backdropFilter: "blur(12px)",
          padding: "10px 24px",
          ...metalFxStyle
        }}
        {...props}
      >
        {children}
      </Button>
    </motion.div>
  );
});

MetalButton.displayName = "MetalButton";

export default MetalButton;
