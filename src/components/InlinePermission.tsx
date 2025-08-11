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

interface InlinePermissionProps {
  permission: PermissionInfo;
  onRespond: (response: "once" | "always" | "reject") => void;
}

const InlinePermission: React.FC<InlinePermissionProps> = ({
  permission,
  onRespond,
}) => {
  console.log("Rendering inline permission:", permission);
  React.useEffect(() => {
    console.log("InlinePermission mounted with permission:", permission);
  }, [permission]);

  return (
    <div
      key={permission.id}
      className="my-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 dark:border-yellow-600 rounded"
    >
      <div className="flex flex-col gap-2">
        <div className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
          🔐 Permission Required
        </div>
        {permission.pattern && (
          <div className="text-xs text-gray-600 dark:text-gray-400 font-mono">
            Pattern: {permission.pattern}
          </div>
        )}
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => onRespond("once")}
            className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Allow Once
          </button>
          <button
            onClick={() => onRespond("always")}
            className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
          >
            Always Allow
          </button>
          <button
            onClick={() => onRespond("reject")}
            className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
          >
            Deny
          </button>
        </div>
      </div>
    </div>
  );
};

export default InlinePermission;
