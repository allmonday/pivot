import { useState } from "react";

export function useLayout() {
  const [planVisible, setPlanVisible] = useState(false);
  const [planWidth, setPlanWidth] = useState(400);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [historyWidth, setHistoryWidth] = useState(500);

  const togglePlan = () => setPlanVisible((v) => !v);
  const closePlan = () => setPlanVisible(false);
  const toggleHistory = () => setHistoryVisible((v) => !v);
  const closeHistory = () => setHistoryVisible(false);

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
  };
}
