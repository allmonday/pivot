import { useEffect, useState } from "react";
import type { FileInfo } from "../types";
import { fetchFiles } from "../api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Folder } from "lucide-react";

interface Props {
  initialPath: string;
  onSelect: (path: string) => void;
  onCancel: () => void;
}

export function FolderPicker({ initialPath, onSelect, onCancel }: Props) {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFiles(currentPath).then(setFiles).catch((e) => setError(e.message));
  }, [currentPath]);

  const directories = files.filter((f) => f.is_dir);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>选择文件夹</DialogTitle>
          <p className="text-xs text-muted-foreground break-all">{currentPath}</p>
        </DialogHeader>

        {error && (
          <div className="text-destructive text-xs px-0">{error}</div>
        )}

        <ScrollArea className="max-h-[400px]">
          <div
            onClick={() => {
              const parent = currentPath.split("/").slice(0, -1).join("/") || "/";
              setCurrentPath(parent);
            }}
            className="px-3 py-1.5 cursor-pointer text-primary text-[13px] hover:bg-accent rounded"
          >
            ..
          </div>

          {directories.map((dir) => (
            <div
              key={dir.path}
              onClick={() => setCurrentPath(dir.path)}
              className="flex items-center gap-2 px-3 py-1.5 cursor-pointer text-[13px] text-primary hover:bg-accent rounded"
            >
              <Folder className="h-3.5 w-3.5 shrink-0" />
              {dir.name}
            </div>
          ))}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>取消</Button>
          <Button onClick={() => onSelect(currentPath)}>选择此文件夹</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
