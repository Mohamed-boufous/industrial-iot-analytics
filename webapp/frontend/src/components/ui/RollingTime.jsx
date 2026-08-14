import React from "react";
import { motion, AnimatePresence } from "framer-motion";

function RollingDigit({ char, charKey }) {
  if (!/\d/.test(char)) {
    return <span style={{ opacity: 0.6, margin: "0 1px" }}>{char}</span>;
  }

  return (
    <span
      style={{
        position: "relative",
        display: "inline-block",
        width: "1ch",
        height: "1.2em",
        overflow: "hidden",
        verticalAlign: "middle",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={charKey}
          initial={{ y: "80%", opacity: 0, filter: "blur(2px)" }}
          animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
          exit={{ y: "-80%", opacity: 0, filter: "blur(2px)" }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {char}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function RollingTime({ timestamp, className = "", style = {} }) {
  const date = timestamp ? new Date(timestamp) : new Date();
  const timeStr = date.toLocaleTimeString("fr-FR", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const chars = timeStr.split("");

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontFamily: "'JetBrains Mono', monospace",
        fontVariantNumeric: "tabular-nums",
        ...style,
      }}
    >
      {chars.map((ch, idx) => (
        <RollingDigit key={idx} char={ch} charKey={`${idx}-${ch}`} />
      ))}
    </span>
  );
}

export default RollingTime;
