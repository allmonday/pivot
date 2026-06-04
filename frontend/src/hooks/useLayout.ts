import { useState } from "react";

export type FileExplorerLayout = "horizontal" | "vertical";

export function useLayout() {
  const [planVisible, setPlanVisible] = useState(false);
  const [planWidth, setPlanWidth] = useState(400);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [historyWidth, setHistoryWidth] = useState(500);
  const [fileExplorerVisible, setFileExplorerVisible] = useState(false);
  const [fileExplorerHeight, setFileExplorerHeight] = useState(300);
  const [fileExplorerLayout, setFileExplorerLayout] = useState<FileExplorerLayout>("vertical");

  const togglePlan = () => setPlanVisible((v) => !v);
  const closePlan = () => setPlanVisible(false);
  const toggleHistory = () => setHistoryVisible((v) => !v);
  const closeHistory = () => setHistoryVisible(false);
  const toggleFileExplorer = () => setFileExplorerVisible((v) => !v);
  const closeFileExplorer = () => setFileExplorerVisible(false);
  const toggleFileExplorerLayout = () =>
    setFileExplorerLayout((v) => (v === "vertical" ? "horizontal" : "vertical"));

  return {
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
  };
}
