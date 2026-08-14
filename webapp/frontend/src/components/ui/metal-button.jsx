import * as React from "react";
import { MetalFx } from "metal-fx";
import { Button } from "./button";
import { cn } from "../../lib/utils";

/**
 * MetalButton wraps the shadcn Button with the animated liquid metal ring powered by MetalFx.
 * Supports auto theme synchronization between Light and Dark modes.
 */
export const MetalButton = React.forwardRef(function MetalButton(
  {
    children,
    className,
    variant = "outline",
    size = "default",
    preset = "chromatic",
    theme,
    metalVariant = "button",
    strength = 1.0,
    paused = false,
    borderRadius = 12,
    normalizeHostStyles = true,
    disableGlow = false,
    shaderScale = 1.8,
    ringCssPx = 3.5,
    scale = 1.0,
    metalFxClassName,
    metalFxStyle,
    onClick,
    ...props
  },
  ref
) {
  // Détection dynamique et réactive du mode Dark vs Light de l'application
  const [currentTheme, setCurrentTheme] = React.useState(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains("dark") || localStorage.getItem("theme") === "dark"
        ? "dark"
        : "light";
    }
    return "dark";
  });

  React.useEffect(() => {
    if (typeof document === "undefined") return;

    const updateTheme = () => {
      const isDark = document.documentElement.classList.contains("dark") || localStorage.getItem("theme") === "dark";
      setCurrentTheme(isDark ? "dark" : "light");
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

  const resolvedTheme = theme || currentTheme;

  return (
    <MetalFx
      ref={ref}
      variant={metalVariant}
      preset={preset}
      theme={resolvedTheme}
      strength={strength}
      paused={paused}
      borderRadius={borderRadius}
      normalizeHostStyles={normalizeHostStyles}
      disableGlow={disableGlow}
      shaderScale={shaderScale}
      ringCssPx={ringCssPx}
      scale={scale}
      className={metalFxClassName}
      style={{
        display: "inline-flex",
        ...metalFxStyle
      }}
    >
      <Button
        variant={variant}
        size={size}
        className={cn(
          "relative transition-all font-semibold tracking-wide !h-auto border-0",
          className
        )}
        onClick={onClick}
        {...props}
      >
        {children}
      </Button>
    </MetalFx>
  );
});

MetalButton.displayName = "MetalButton";

export default MetalButton;
