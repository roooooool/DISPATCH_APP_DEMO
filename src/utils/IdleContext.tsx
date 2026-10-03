import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

interface IdleContextType {
    userIdle: boolean;
    tabVisible: boolean;
    isBackendActive: boolean;
    lastActivity: number;
    resetIdleTimer: () => void;
}

let backendRequestsAllowed = true;

export function canAccessBackend(): boolean {
    return backendRequestsAllowed;
}

const IdleContext = createContext<IdleContextType | undefined>(undefined);

const IDLE_TIMEOUT = 5 * 60 * 1000; // 1 second for testing
// const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

interface IdleProviderProps {
    children: React.ReactNode;
    enabled?: boolean;
}

export function IdleProvider({ children, enabled = true, }: IdleProviderProps) {
    const [userIdle, setUserIdle] = useState(false);
    const [tabVisible, setTabVisible] = useState(
        document.visibilityState === "visible"
    );
    const [lastActivity, setLastActivity] = useState(Date.now());

    const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const BASE_TITLE = "GSDC Dispatch App";

    useEffect(() => {
        document.title = userIdle
            ? `${BASE_TITLE} (IDLE)`
            : BASE_TITLE;
    }, [userIdle]);

    const resetIdleTimer = useCallback(() => {
        if (!enabled || userIdle) {
            return;
        }

        setLastActivity(Date.now());

        if (idleTimerRef.current) {
            clearTimeout(idleTimerRef.current);
        }

        idleTimerRef.current = setTimeout(() => {
            setUserIdle(true);
        }, IDLE_TIMEOUT);
    }, [enabled, userIdle]);

    useEffect(() => {
        if (!enabled) {
            if (idleTimerRef.current) {
                clearTimeout(idleTimerRef.current);
            }

            return;
        }

        const activityEvents = [
            "mousemove",
            "mousedown",
            "keydown",
            "scroll",
            "touchstart",
            "pointerdown",
        ];

        const handleActivity = () => {
            if (userIdle) {
                return;
            }

            if (document.visibilityState !== "visible") {
                return;
            }

            resetIdleTimer();
        };

        const handleVisibilityChange = () => {
            const visible = document.visibilityState === "visible";

            setTabVisible(visible);

            if (visible && !userIdle) {
                resetIdleTimer();
            }
        };

        activityEvents.forEach((event) => {
            window.addEventListener(event, handleActivity, {
                passive: true,
            });
        });

        document.addEventListener(
            "visibilitychange",
            handleVisibilityChange
        );

        resetIdleTimer();

        return () => {
            activityEvents.forEach((event) => {
                window.removeEventListener(event, handleActivity);
            });

            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange
            );

            if (idleTimerRef.current) {
                clearTimeout(idleTimerRef.current);
            }
        };
    }, [enabled, resetIdleTimer, userIdle]);

    const isBackendActive = tabVisible && !userIdle;

    useEffect(() => {
        backendRequestsAllowed = isBackendActive;
    }, [isBackendActive]);

    const value = useMemo<IdleContextType>(
        () => ({
            userIdle,
            tabVisible,
            isBackendActive,
            lastActivity,
            resetIdleTimer,
        }),
        [
            userIdle,
            tabVisible,
            isBackendActive,
            lastActivity,
            resetIdleTimer,
        ]
    );

    return (
        <IdleContext.Provider value={value}>
            {children}

            {userIdle && (
                <div
                    style={styles.overlay}
                    onMouseDown={(event) => {
                        // Prevent clicks from reaching anything
                        // underneath the idle overlay.
                        event.preventDefault();
                        event.stopPropagation();
                    }}
                    onClick={(event) => {
                        // Clicking outside the modal does nothing.
                        event.preventDefault();
                        event.stopPropagation();
                    }}
                >
                    <div
                        style={styles.modal}
                        onClick={(event) => {
                            event.stopPropagation();
                        }}
                    >
                        <div style={styles.title}>
                            Are you still there?
                        </div>

                        <div style={styles.message}>
                            You have been inactive for 5 minutes.
                            <br />
                            Click "Yes" to continue using the dispatch app.
                        </div>

                        <button
                            style={styles.button}
                            onClick={() => {
                                window.location.reload();
                            }}
                        >
                            Yes
                        </button>
                    </div>
                </div>
            )}
        </IdleContext.Provider>
    );
}

export function useIdle(): IdleContextType {
    const context = useContext(IdleContext);

    if (!context) {
        throw new Error(
            "useIdle must be used inside an IdleProvider"
        );
    }

    return context;
}

const styles: Record<string, React.CSSProperties> = {
    overlay: {
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.55)",
    },

    modal: {
        width: "min(420px, calc(100vw - 40px))",
        padding: "30px",
        borderRadius: "12px",
        backgroundColor: "#fff",
        boxShadow: "0 10px 40px rgba(0, 0, 0, 0.3)",
        textAlign: "center",
    },

    title: {
        fontSize: "24px",
        fontWeight: 700,
        marginBottom: "15px",
    },

    message: {
        fontSize: "15px",
        lineHeight: 1.5,
        color: "#555",
        marginBottom: "25px",
    },

    button: {
        minWidth: "120px",
        padding: "10px 24px",
        border: "none",
        borderRadius: "6px",
        backgroundColor: "#092162",
        color: "#fff",
        fontSize: "15px",
        fontWeight: 600,
        cursor: "pointer",
    },
};