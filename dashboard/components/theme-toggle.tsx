"use client";

import { Moon, Sun } from "phosphor-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/theme-provider";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      size="sm"
      variant="ghost"
    >
      {resolvedTheme === "dark" ? <Sun size={16} weight="bold" /> : <Moon size={16} weight="bold" />}
    </Button>
  );
}
