import { createContext, useContext, useState, type ReactNode } from "react";

export type FileExplorerLayout = "horizontal" | "vertical";

export interface LayoutState {
  sidebarVisible: boolean;
  toggleSidebar: () => void;
  planVisible: boolean;
  setPlanVisible: (v: boolean) => void;
  planWidth: number;
  setPlanWidth: (v: number) => void;
  togglePlan: () => void;
  closePlan: () => void;
  historyVisible: boolean;
  setHistoryVisible: (v: boolean) => void;
  historyWidth: number;
  setHistoryWidth: (v: number) => void;
  toggleHistory: () => void;
  closeHistory: () => void;
  fileExplorerVisible: boolean;
  setFileExplorerVisible: (v: boolean) => void;
  fileExplorerHeight: number;
  setFileExplorerHeight: (v: number) => void;
  fileExplorerLayout: FileExplorerLayout;
  toggleFileExplorerLayout: () => void;
  toggleFileExplorer: () => void;
  closeFileExplorer: () => void;
  terminalVisible: boolean;
  setTerminalVisible: (v: boolean) => void;
  terminalHeight: number;
  setTerminalHeight: (v: number) => void;
  toggleTerminal: () => void;
  closeTerminal: () => void;
}

const LayoutContext = createContext<LayoutState | null>(null);

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [planVisible, setPlanVisible] = useState(false);
  const [planWidth, setPlanWidth] = useState(400);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [historyWidth, setHistoryWidth] = useState(500);
  const [fileExplorerVisible, setFileExplorerVisible] = useState(false);
  const [fileExplorerHeight, setFileExplorerHeight] = useState(300);
  const [fileExplorerLayout, setFileExplorerLayout] = useState<FileExplorerLayout>("vertical");
  const [terminalVisible, setTerminalVisible] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(250);

  const toggleSidebar = () => setSidebarVisible((v) => !v);
  const togglePlan = () => setPlanVisible((v) => !v);
  const closePlan = () => setPlanVisible(false);
  const toggleHistory = () => setHistoryVisible((v) => !v);
  const closeHistory = () => setHistoryVisible(false);
  const toggleFileExplorer = () => setFileExplorerVisible((v) => !v);
  const closeFileExplorer = () => setFileExplorerVisible(false);
  const toggleFileExplorerLayout = () =>
    setFileExplorerLayout((v) => (v === "vertical" ? "horizontal" : "vertical"));
  const toggleTerminal = () => setTerminalVisible((v) => !v);
  const closeTerminal = () => setTerminalVisible(false);

  const value: LayoutState = {
    sidebarVisible,
    toggleSidebar,
    planVisible,
    setPlanVisible,
    planWidth,
    setPlanWidth,
    togglePlan,
    closePlan,
    historyVisible,
    setHistoryVisible,
    historyWidth,
    setHistoryWidth,
    toggleHistory,
    closeHistory,
    fileExplorerVisible,
    setFileExplorerVisible,
    fileExplorerHeight,
    setFileExplorerHeight,
    fileExplorerLayout,
    toggleFileExplorerLayout,
    toggleFileExplorer,
    closeFileExplorer,
    terminalVisible,
    setTerminalVisible,
    terminalHeight,
    setTerminalHeight,
    toggleTerminal,
    closeTerminal,
  };

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
}

export function useLayout(): LayoutState {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error("useLayout must be used within LayoutProvider");
  return ctx;
}
