import React from "react";

interface InlinePermissionProps {
  permission: {
    id: string;
    type: string;
    title: string;
    metadata?: any;
  };
  onRespond: (response: "once" | "always" | "reject") => void;
}

export default function InlinePermission({
  permission,
  onRespond,
}: InlinePermissionProps) {
  return (
    <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded">
      <div className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
        ⚠️ Permission required: {permission.title}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onRespond("once")}
          className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Allow Once
        </button>
        <button
          onClick={() => onRespond("always")}
          className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
        >
          Allow Always
        </button>
        <button
          onClick={() => onRespond("reject")}
          className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
