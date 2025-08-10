import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface PermissionConfig {
  edit?: "ask" | "allow" | "deny";
  bash?: string | Record<string, "ask" | "allow" | "deny">;
}

interface Config {
  permission?: PermissionConfig;
  [key: string]: any;
}

export default function ConfigManager({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState<"ask" | "allow" | "deny">("ask");
  const [bashMode, setBashMode] = useState<"ask" | "allow" | "deny">("ask");
  const [bashWildcard, setBashWildcard] = useState(true);
  const [customBashRules, setCustomBashRules] = useState<
    Array<{ pattern: string; mode: "ask" | "allow" | "deny" }>
  >([]);

  // Fetch current config
  const { data: config, isLoading } = useQuery({
    queryKey: ["config"],
    queryFn: async () => {
      const res = await fetch("/config");
      if (!res.ok) throw new Error("Failed to fetch config");
      return res.json() as Promise<Config>;
    },
  });

  // Initialize state from config
  useEffect(() => {
    if (config?.permission) {
      setEditMode(config.permission.edit || "ask");
      if (typeof config.permission.bash === "string") {
        setBashMode(config.permission.bash);
        setBashWildcard(true);
      } else if (config.permission.bash) {
        setBashWildcard(false);
        const rules = Object.entries(config.permission.bash).map(
          ([pattern, mode]) => ({
            pattern,
            mode: mode as "ask" | "allow" | "deny",
          }),
        );
        setCustomBashRules(rules);
        // Set default bash mode from wildcard if exists
        if (config.permission.bash["*"]) {
          setBashMode(config.permission.bash["*"]);
        }
      }
    }
  }, [config]);

  const updateConfig = useMutation({
    mutationFn: async (newConfig: Config) => {
      const res = await fetch("/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newConfig),
      });
      if (!res.ok) throw new Error("Failed to update config");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config"] });
    },
  });

  const handleSave = () => {
    const permission: PermissionConfig = {
      edit: editMode,
    };

    if (bashWildcard) {
      permission.bash = bashMode;
    } else {
      const bashRules: Record<string, "ask" | "allow" | "deny"> = {
        "*": bashMode, // Default wildcard
      };
      customBashRules.forEach((rule) => {
        if (rule.pattern) {
          bashRules[rule.pattern] = rule.mode;
        }
      });
      permission.bash = bashRules;
    }

    updateConfig.mutate({
      ...config,
      permission,
    });
    onClose();
  };

  const addBashRule = () => {
    setCustomBashRules([...customBashRules, { pattern: "", mode: "ask" }]);
  };

  const removeBashRule = (index: number) => {
    setCustomBashRules(customBashRules.filter((_, i) => i !== index));
  };

  const updateBashRule = (
    index: number,
    field: "pattern" | "mode",
    value: string,
  ) => {
    const updated = [...customBashRules];
    if (field === "pattern") {
      updated[index].pattern = value;
    } else {
      updated[index].mode = value as "ask" | "allow" | "deny";
    }
    setCustomBashRules(updated);
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full p-6">
          <div className="text-center">Loading configuration...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full p-6 my-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Permission Configuration
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          {/* File Edit Permissions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              File Edit Permissions
            </label>
            <select
              value={editMode}
              onChange={(e) => setEditMode(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
            >
              <option value="ask">Ask for permission</option>
              <option value="allow">Always allow</option>
              <option value="deny">Always deny</option>
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Controls whether file edits require approval
            </p>
          </div>

          {/* Bash Command Permissions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Bash Command Permissions
            </label>

            <div className="mb-3">
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={bashWildcard}
                  onChange={() => setBashWildcard(true)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Simple mode (one rule for all commands)
                </span>
              </label>
              <label className="flex items-center mt-2">
                <input
                  type="radio"
                  checked={!bashWildcard}
                  onChange={() => setBashWildcard(false)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Advanced mode (pattern-based rules)
                </span>
              </label>
            </div>

            {bashWildcard ? (
              <select
                value={bashMode}
                onChange={(e) => setBashMode(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
              >
                <option value="ask">Ask for permission</option>
                <option value="allow">Always allow</option>
                <option value="deny">Always deny</option>
              </select>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400 flex-1">
                    Default (*)
                  </span>
                  <select
                    value={bashMode}
                    onChange={(e) => setBashMode(e.target.value as any)}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-slate-700 text-sm"
                  >
                    <option value="ask">Ask</option>
                    <option value="allow">Allow</option>
                    <option value="deny">Deny</option>
                  </select>
                </div>

                {customBashRules.map((rule, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={rule.pattern}
                      onChange={(e) =>
                        updateBashRule(index, "pattern", e.target.value)
                      }
                      placeholder="Pattern (e.g., 'rm *', 'npm install')"
                      className="flex-1 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-slate-700 text-sm"
                    />
                    <select
                      value={rule.mode}
                      onChange={(e) =>
                        updateBashRule(index, "mode", e.target.value)
                      }
                      className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-slate-700 text-sm"
                    >
                      <option value="ask">Ask</option>
                      <option value="allow">Allow</option>
                      <option value="deny">Deny</option>
                    </select>
                    <button
                      onClick={() => removeBashRule(index)}
                      className="px-2 py-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    >
                      ✕
                    </button>
                  </div>
                ))}

                <button
                  onClick={addBashRule}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  + Add Rule
                </button>
              </div>
            )}

            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {bashWildcard
                ? "Controls whether bash commands require approval"
                : "Pattern-based rules are checked in order. First match wins."}
            </p>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
              About Permissions
            </h3>
            <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
              <li>
                • <strong>Ask:</strong> Prompt for each operation
              </li>
              <li>
                • <strong>Allow:</strong> Automatically approve operations
              </li>
              <li>
                • <strong>Deny:</strong> Automatically reject operations
              </li>
              <li>• Changes apply to new sessions immediately</li>
              <li>
                • "Allow Always" responses in prompts only last for the current
                session
              </li>
            </ul>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={updateConfig.isPending}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:shadow-lg disabled:opacity-50"
          >
            {updateConfig.isPending ? "Saving..." : "Save Configuration"}
          </button>
        </div>
      </div>
    </div>
  );
}
