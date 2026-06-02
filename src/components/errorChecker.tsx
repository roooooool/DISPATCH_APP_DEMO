import React, { createContext, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppConfig } from '../components/maintenanceChecker';
import {useUser} from '../utils/useUser';




export const ErrorCheckerContext = createContext(null);

export const ErrorChecker: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const user = useUser();

    const { config } = useAppConfig();

    const PRNK_ERROR_TYPES = ["AttributeError", "KeyError", "IndexError", "RuntimeError", "FatalRuntimeError", "TypeError", "ValueError", "ImportError"];
    const PRNK_FILES = ["/src/components/TableFlex.tsx", "/src/pages/LandingPage.tsx", "/src/utils/TaskWorkerContext.tsx", "/node_modules/vite/dist/client.js", "/src/truth.config.ts", "/src/App.tsx", "/src/components/Navbar.tsx", "/src/utils/useUser.ts", "/src/components/ChatBox.tsx", "/src/components/NotificationBell.tsx", "/src/components/SettingsModal.tsx", "/src/utils/NotificationContext.tsx", "/src/components/ProtectedRoute.tsx", "/src/components/maintenanceChecker.tsx", "/src/components/errorChecker.tsx", "/src/components/versionChecker.tsx", "/src/pages/ErrorPage.tsx", "/src/pages/UpdateRequiredPage.tsx", "/src/pages/DeveloperPage.tsx"];
    const PRNK_FUNCTIONS = ["synchronize_context", "_hydrate", "attach", "expand", "resolve_frame", "merge_layers", "dispatch_event"];
    const PRNK_MESSAGES = ["'NoneType' object has no attribute 'flags'", "'shadow_index'", "failed to rebind transient execution frame", "cannot resolve deferred pointer", "unexpected EOF", "invalid memory snapshot state"];
    const PRNK_VARIABLES = ["node.cache['shadow_index']", "cursor.meta.flags", "frame.locals['__token']", "resolver.expand(layer.ref)", "runtime.snapshot()", "event.data['payload']", "context['user_session']['permissions']", "worker.state['hydration_complete']", "container['active']", "pointer['resolved']", "task['progress']", "layer['dependencies']", "snapshot['frames']", "event['type']", "frame['locals']['__token']", "worker['state']['hydration_complete']", "context['user_session']['permissions']", "container['active']", "pointer['resolved']", "task['progress']", "layer['dependencies']", "snapshot['frames']", "event['type']", "frame['locals']['__token']", "worker['state']['hydration_complete']", "context['user_session']['permissions']", "container['active']", "pointer['resolved']", "task['progress']", "layer['dependencies']", "snapshot['frames']", "event['type']"];

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
        console.log(randomTitle);
        
        

        // Force navigate to your Error Page
        navigate('/error', {
          state: {
            details: randomStack,
            actionText: "Return to Home",
            actionPath: location.pathname,
            required: true, // Mark this error as required to report
          }
        });
      }
    };

    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [navigate]);

  // dev go back
  const useKeyboardShortcut = (callback: () => void) => {
    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        // Check for Ctrl + Shift + Backspace
        const isCtrl = event.ctrlKey || event.metaKey; // metaKey for Mac users
        const isShift = event.shiftKey;
        const isBackspace = event.key === 'Backspace';

        if (isCtrl && isShift && isBackspace) {
          // Prevent default browser behavior (if any)
          event.preventDefault();
          callback();
        }
      };

      // Attach listener
      window.addEventListener('keydown', handleKeyDown);

      // Clean up on unmount
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }, [callback]);
  };

  useKeyboardShortcut(() => {
    if (user.user?.Position !== "Developer") {console.log("Unauthorized user attempted to use dev shortcut"); return;}
    user.updateUser({CurrentNav: "/dash"});
    navigate(-1); // Go back to the previous page
  });

  return (
    <ErrorCheckerContext.Provider value={null}>
      {children}
    </ErrorCheckerContext.Provider>
  );
};