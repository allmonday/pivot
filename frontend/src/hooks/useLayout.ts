import { useState } from "react";

export function useLayout() {
  const [planVisible, setPlanVisible] = useState(false);
  const [planWidth, setPlanWidth] = useState(400);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [historyWidth, setHistoryWidth] = useState(500);
  const [fileExplorerVisible, setFileExplorerVisible] = useState(false);
  const [fileExplorerHeight, setFileExplorerHeight] = useState(300);

  const togglePlan = () => setPlanVisible((v) => !v);
  const closePlan = () => setPlanVisible(false);
  const toggleHistory = () => setHistoryVisible((v) => !v);
  const closeHistory = () => setHistoryVisible(false);
  const toggleFileExplorer = () => setFileExplorerVisible((v) => !v);
  const closeFileExplorer = () => setFileExplorerVisible(false);

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
    toggleFileExplorer,
    closeFileExplorer,
  };
}
