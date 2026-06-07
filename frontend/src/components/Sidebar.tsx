import { useState } from "react";
import type { Folder, Task } from "../types";
import { useFolderTree } from "../hooks/useFolderTree";
import { FolderPicker } from "./FolderPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { ChevronDown, ChevronRight, Plus, X, Info, FolderIcon, FileText, RefreshCw, MessageSquareText } from "lucide-react";
import Markdown from "react-markdown";

interface Props {
  selectedFolderId: string | null;
  selectedTaskId: string | null;
  workingTaskIds: Set<string>;
  doneTaskIds: Set<string>;
  onSelectFolder: (folder: Folder) => void;
  onSelectTask: (task: Task) => void;
}

export function Sidebar({ selectedFolderId, selectedTaskId, workingTaskIds, doneTaskIds, onSelectFolder, onSelectTask }: Props) {
  const {
    folders,
    tasksMap,
    expandedFolderIds,
    summarizingTaskId,
    toggleFolder,
    addFolder,
    removeFolder,
    addTask,
    removeTask,
    summarize,
  } = useFolderTree();

  // Form state
  const [showFolderForm, setShowFolderForm] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderPath, setFolderPath] = useState("");
  const [taskNames, setTaskNames] = useState("");
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);

  const [addingTaskForFolder, setAddingTaskForFolder] = useState<string | null>(null);
  const [newTaskName, setNewTaskName] = useState("");
  const [creatingTask, setCreatingTask] = useState(false);

  const handleFolderClick = (folder: Folder) => {
    toggleFolder(folder, onSelectFolder);
  };

  const handleFolderCreate = async () => {
    if (!folderName.trim() || !folderPath.trim()) return;
    setCreatingFolder(true);
    try {
      const names = taskNames.split("\n").map((n) => n.trim()).filter(Boolean);
      await addFolder({ name: folderName.trim(), folder_path: folderPath.trim(), task_names: names }, onSelectFolder);
      setFolderName("");
      setFolderPath("");
      setTaskNames("");
      setShowFolderForm(false);
    } catch (e) {
      console.error(e);
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleFolderDelete = async (e: React.MouseEvent, folderId: string) => {
    e.stopPropagation();
    if (!confirm("确认删除此文件夹及其所有任务？")) return;
    try {
      await removeFolder(folderId);
    } catch (err) {
      console.error(err);
    }
  };

  const handleTaskCreate = async () => {
    if (!newTaskName.trim() || !addingTaskForFolder) return;
    setCreatingTask(true);
    try {
      await addTask({ name: newTaskName.trim(), folder_id: addingTaskForFolder }, onSelectTask);
      setNewTaskName("");
      setAddingTaskForFolder(null);
    } catch (e) {
      console.error(e);
    } finally {
      setCreatingTask(false);
    }
  };

  const handleTaskDelete = async (e: React.MouseEvent, taskId: string, folderId: string) => {
    e.stopPropagation();
    if (!confirm("确认删除此任务？")) return;
    try {
      await removeTask(taskId, folderId);
    } catch (err) {
      console.error(err);
    }
  };

  const startAddTask = (e: React.MouseEvent, folderId: string) => {
    e.stopPropagation();
    setAddingTaskForFolder(folderId);
    setNewTaskName("");
  };

  const handleSummarize = (e: React.MouseEvent, taskId: string, folderId: string) => {
    e.stopPropagation();
    summarize(taskId, folderId);
  };

  return (
    <div className="p-4 flex flex-col h-full">
      <h3 className="mb-3 text-[15px] font-semibold text-muted-foreground tracking-wide">工作区</h3>

      <div className="flex-1 overflow-auto scrollbar-thin">
        {folders.map((folder) => {
          const isExpanded = expandedFolderIds.has(folder.id);
          const tasks = tasksMap[folder.id] || [];
          return (
            <div key={folder.id}>
              <div
                className={`group flex items-center gap-2 rounded-lg px-3 py-2 mb-0.5 cursor-pointer text-[14px] font-medium hover:bg-accent ${
                  selectedFolderId === folder.id ? "bg-accent" : ""
                }`}
                onClick={() => handleFolderClick(folder)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <FolderIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate flex-1">{folder.name}</span>
                <Plus
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 hover:text-primary cursor-pointer"
                  onClick={(e) => startAddTask(e, folder.id)}
                />
                <Tooltip>
                  <TooltipTrigger className="border-0 bg-transparent p-0 cursor-help">
                    <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs max-w-[300px] break-all">
                    {folder.folder_path}
                  </TooltipContent>
                </Tooltip>
                <X
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30 hover:text-destructive cursor-pointer"
                  onClick={(e) => handleFolderDelete(e, folder.id)}
                />
              </div>

              {isExpanded && (
                <div className="ml-5 pl-2 border-l border-border/60">
                  {tasks.map((task) => {
                    const isSelected = selectedTaskId === task.id;
                    const isWorking = workingTaskIds.has(task.id);
                    const isDone = doneTaskIds.has(task.id);
                    const hasSummary = !!task.summary;
                    const isSummarizing = summarizingTaskId === task.id;
                    return (
                      <div key={task.id}>
                        <div
                          onClick={() => onSelectTask(task)}
                          className={`flex items-center gap-2 px-2.5 py-1.5 mb-0.5 rounded-md cursor-pointer text-[13px] font-normal ${
                            isSelected ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                          }`}
                        >
                          <FileText className="h-3.5 w-3.5 shrink-0 opacity-50" />
                          <span className="truncate flex-1">{task.name}</span>
                          {isWorking && (
                            <span className="text-[11px] text-orange-500 font-medium ml-1">working</span>
                          )}
                          {isDone && !isWorking && (
                            <span className="text-[11px] text-emerald-600 font-medium ml-1">done</span>
                          )}
                          {hasSummary && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex"><MessageSquareText className="h-3 w-3 shrink-0 text-muted-foreground/50 cursor-pointer" /></span>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-[320px] text-left bg-popover text-popover-foreground shadow-lg sidebar-summary-popover">
                                <Markdown>{task.summary!}</Markdown>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          <RefreshCw
                            className={`h-3 w-3 shrink-0 text-muted-foreground/30 hover:text-primary cursor-pointer ${isSummarizing ? "animate-spin" : ""}`}
                            onClick={(e) => handleSummarize(e, task.id, folder.id)}
                          />
                          <X
                            className="h-3 w-3 shrink-0 text-muted-foreground/30 hover:text-destructive cursor-pointer"
                            onClick={(e) => handleTaskDelete(e, task.id, folder.id)}
                          />
                        </div>
                      </div>
                    );
                  })}

                  {addingTaskForFolder === folder.id && (
                    <div className="flex items-center gap-1 py-1.5">
                      <Input
                        placeholder="任务名称"
                        value={newTaskName}
                        onChange={(e) => setNewTaskName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleTaskCreate();
                          if (e.key === "Escape") setAddingTaskForFolder(null);
                        }}
                        autoFocus
                        className="h-7 text-xs"
                      />
                      <Button
                        size="sm"
                        onClick={handleTaskCreate}
                        disabled={creatingTask || !newTaskName.trim()}
                        className="h-7 text-xs px-2.5"
                      >
                        {creatingTask ? "..." : "确认"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAddingTaskForFolder(null)}
                        className="h-7 text-xs px-2"
                      >
                        取消
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Separator className="my-2" />

      {showFolderForm ? (
        <div className="space-y-1.5 pt-2">
          <Input
            placeholder="文件夹名称"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            className="h-8 text-sm"
          />
          <div className="flex gap-1">
            <Input
              placeholder="目录路径"
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              className="h-8 flex-1 text-xs"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFolderPicker(true)}
              className="h-8 text-xs shrink-0"
            >
              浏览
            </Button>
          </div>
          <Textarea
            placeholder="初始任务（每行一个，可选）"
            value={taskNames}
            onChange={(e) => setTaskNames(e.target.value)}
            rows={3}
            className="text-xs resize-y"
          />
          <div className="flex justify-end gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowFolderForm(false); setFolderName(""); setFolderPath(""); setTaskNames(""); }}
              className="text-xs"
            >
              取消
            </Button>
            <Button
              size="sm"
              onClick={handleFolderCreate}
              disabled={creatingFolder || !folderName.trim() || !folderPath.trim()}
              className="text-xs"
            >
              {creatingFolder ? "创建中..." : "创建"}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          onClick={() => setShowFolderForm(true)}
          className="mt-2 w-full border-dashed text-muted-foreground"
        >
          <Plus className="h-4 w-4 mr-1" />
          新建文件夹
        </Button>
      )}

      {showFolderPicker && (
        <FolderPicker
          initialPath={folderPath || "/"}
          onSelect={(path) => { setFolderPath(path); setShowFolderPicker(false); }}
          onCancel={() => setShowFolderPicker(false)}
        />
      )}
    </div>
  );
}
