import React, { createContext, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppConfig } from '../components/maintenanceChecker';




export const ErrorCheckerContext = createContext(null);

export const ErrorChecker: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();

    const { config } = useAppConfig();

    const PRNK_ERROR_TYPES = ["AttributeError", "KeyError", "IndexError", "RuntimeError", "FatalRuntimeError", "TypeError", "ValueError", "ImportError"];
    const PRNK_FILES = ["/src/components/TableFlex.tsx", "/src/pages/LandingPage.tsx", "/src/utils/TaskWorkerContext.tsx", "/node_modules/vite/dist/client.js", "/src/truth.config.ts"];
    const PRNK_FUNCTIONS = ["synchronize_context", "_hydrate", "attach", "expand", "resolve_frame", "merge_layers", "dispatch_event"];
    const PRNK_MESSAGES = ["'NoneType' object has no attribute 'flags'", "'shadow_index'", "failed to rebind transient execution frame", "cannot resolve deferred pointer", "unexpected EOF", "invalid memory snapshot state"];
    const PRNK_VARIABLES = ["node.cache['shadow_index']", "cursor.meta.flags", "frame.locals['__token']", "resolver.expand(layer.ref)", "runtime.snapshot()"];

    const generateRandomStacktrace = (frames = 4): string => {
    const lines = ["Traceback (most recent call last):"];

    for (let i = 0; i < frames; i++) {
        const file = PRNK_FILES[Math.floor(Math.random() * PRNK_FILES.length)];
        const lineNo = Math.floor(Math.random() * 490) + 10;
        const func = PRNK_FUNCTIONS[Math.floor(Math.random() * PRNK_FUNCTIONS.length)];
        const variable = PRNK_VARIABLES[Math.floor(Math.random() * PRNK_VARIABLES.length)];

        lines.push(`  File "${file}", line ${lineNo}, in ${func}`);
        lines.push(`    ${variable}`);
    }

    const error = PRNK_ERROR_TYPES[Math.floor(Math.random() * PRNK_ERROR_TYPES.length)];
    const message = PRNK_MESSAGES[Math.floor(Math.random() * PRNK_MESSAGES.length)];
    const hex = Math.random().toString(16).substring(2, 10);

    lines.push(`${error}: ${message} [${hex}]`);
        return lines.join("\n");
    };

    const PRNK_TITLES = [
        "Critical Hydration Failure",
        "Memory Leak Detected",
        "Intrusive Ad Blocker Conflict",
        "Recursive Loop Exception",
        "Data Integrity Violation",
        "Unauthorized Context Access",
        "Shadow Container Failed to Expand",
        "Transient Frame Rebinding Error",
        "Deferred Pointer Resolution Failed",
        "Unexpected End of Execution",
        undefined,
    ];

  useEffect(() => {
    const handleGlobalClick = () => {
        // console.log("current config prob: ", config.pt900.prob)
      if (Math.random() < config.pt900.prob) {
        if (location.pathname.startsWith('/error')) {
            return;
        }


        // Generate random error data
        const randomTitle = PRNK_TITLES[Math.floor(Math.random() * PRNK_TITLES.length)];
        const randomStack = generateRandomStacktrace();
        
        

        // Force navigate to your Error Page
        navigate('/error', {
          state: {
            title: randomTitle,
            // message: "This is a system-generated chaos test to verify error reporting and UI responsiveness.",
            details: randomStack,
            actionText: "Return to Dashboard",
            actionPath: "/dash"
          }
        });
      }
    };

    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [navigate]);

  return (
    <ErrorCheckerContext.Provider value={null}>
      {children}
    </ErrorCheckerContext.Provider>
  );
};