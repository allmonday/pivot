import type { PermissionRequest } from "../types";
import { resolvePermission } from "../api";
import { Button } from "@/components/ui/button";

interface Props {
  taskId: string;
  permission: PermissionRequest;
  onDismiss: () => void;
}

export function PermissionRequestDialog({ taskId, permission, onDismiss }: Props) {
  return (
    <div className="mt-2.5 p-3 border border-amber-500 rounded-xl bg-amber-50">
      <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold">!</span>
        <span>{permission.title || `${permission.tool_name} permission`}</span>
      </div>
      {permission.description && (
        <div className="mt-1.5 text-[13px] text-amber-800">{permission.description}</div>
      )}
      {permission.blocked_path && (
        <div className="mt-1 text-xs font-mono text-amber-900 bg-amber-100 px-2 py-1 rounded">
          {permission.blocked_path}
        </div>
      )}
      <div className="mt-2.5 flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="border-emerald-500 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 font-semibold"
          onClick={async () => {
            try {
              await resolvePermission(taskId, permission.request_id, "allow");
            } catch { /* ignore */ }
            onDismiss();
          }}
        >
          Allow
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-red-500 bg-red-50 text-red-900 hover:bg-red-100 font-semibold"
          onClick={async () => {
            try {
              await resolvePermission(taskId, permission.request_id, "deny");
            } catch { /* ignore */ }
            onDismiss();
          }}
        >
          Deny
        </Button>
      </div>
    </div>
  );
}
