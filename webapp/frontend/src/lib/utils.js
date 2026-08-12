import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Fonction utilitaire pour fusionner les classes CSS intelligemment
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
