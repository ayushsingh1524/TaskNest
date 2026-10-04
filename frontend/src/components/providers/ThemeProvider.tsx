"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { useThemeStore, getAutoTheme } from "@/store/themeStore";
import { useEffect, useState } from "react";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { mode } = useThemeStore();
  const [autoTheme, setAutoTheme] = useState<string>(() => getAutoTheme());

  useEffect(() => {
    if (mode !== "auto") return;
    const interval = setInterval(() => setAutoTheme(getAutoTheme()), 60_000);
    return () => clearInterval(interval);
  }, [mode]);

  const resolvedTheme = mode === "auto" ? autoTheme : mode;

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={resolvedTheme}
      forcedTheme={resolvedTheme}
      enableSystem={false}
      disableTransitionOnChange={false}
    >
      {children}
    </NextThemesProvider>
  );
}
