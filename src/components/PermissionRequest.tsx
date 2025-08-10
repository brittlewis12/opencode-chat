import React from "react";

export interface PermissionInfo {
  id: string;
  type: string;
  pattern?: string;
  sessionID: string;
  messageID: string;
  callID?: string;
  title: string;
  metadata: Record<string, any>;
  time: {
    created: number;
  };
}

interface PermissionRequestProps {
  permission: PermissionInfo;
  onRespond: (response: "once" | "always" | "reject") => void;
}

export default function PermissionRequest({
  permission,
  onRespond,
}: PermissionRequestProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Permission Request
          </h3>
          <p className="text-gray-700 dark:text-gray-300">{permission.title}</p>
        </div>

        <div className="mb-6">
          <div className="bg-gray-100 dark:bg-slate-700 rounded p-3 text-sm">
            <div className="text-gray-600 dark:text-gray-400 mb-1">
              Type: {permission.type}
            </div>
            {permission.pattern && (
              <div className="text-gray-600 dark:text-gray-400 mb-1">
                Pattern: {permission.pattern}
              </div>
            )}
            {Object.keys(permission.metadata).length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-gray-600 dark:text-gray-400">
                  Details
                </summary>
                <pre className="mt-2 text-xs overflow-auto">
                  {JSON.stringify(permission.metadata, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onRespond("once")}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Allow Once
          </button>
          <button
            onClick={() => onRespond("always")}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            Allow Always
          </button>
          <button
            onClick={() => onRespond("reject")}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
