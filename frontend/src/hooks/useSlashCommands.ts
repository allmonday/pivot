import { useEffect, useState } from "react";
import type { SlashCommand } from "../components/SlashCommandMenu";
import { fetchCommands } from "../api";

export function useSlashCommands() {
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [slashCommands, setSlashCommands] = useState<SlashCommand[]>([]);

  useEffect(() => {
    fetchCommands().then(setSlashCommands).catch(console.error);
  }, []);

  const handleInputChange = (value: string) => {
    if (value.startsWith("/")) {
      const spaceIdx = value.indexOf(" ");
      if (spaceIdx === -1) {
        setSlashFilter(value.slice(1));
        setSlashMenuOpen(true);
      } else {
        setSlashMenuOpen(false);
      }
    } else {
      setSlashMenuOpen(false);
    }
  };

  return {
    slashMenuOpen,
    setSlashMenuOpen,
    slashFilter,
    slashCommands,
    handleInputChange,
  };
}
