import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    let preferred = window.matchMedia("(prefers-color-scheme: dark)").matches;
    try {
      const saved = localStorage.getItem("gabarito-theme");
      if (saved === "dark" || saved === "light") preferred = saved === "dark";
    } catch { /* O tema funciona mesmo sem acesso ao armazenamento. */ }
    document.documentElement.classList.toggle("dark", preferred);
    setDark(preferred);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("gabarito-theme", next ? "dark" : "light"); } catch { /* Sem persistência. */ }
  }

  const label = dark ? "Ativar modo claro" : "Ativar modo escuro";
  return <Button size="icon" variant="outline" aria-label={label} title={label} onClick={toggle}>{dark ? <Sun /> : <Moon />}</Button>;
}