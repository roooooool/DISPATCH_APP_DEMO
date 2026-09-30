
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { msalInstance, msalInitPromise } from "../api/msalConfig";

export default function MicrosoftCallback() {
    const navigate = useNavigate();

    useEffect(() => {
        const processMicrosoftLogin = async () => {
            try {
                await msalInitPromise;

                const result = await msalInstance.handleRedirectPromise();

                console.log("MICROSOFT CALLBACK RESULT:", result);

                if (result?.account) {
                    msalInstance.setActiveAccount(result.account);

                    console.log("Microsoft account:", result.account);

                    // For now, go back to login.
                    // We'll replace this with your backend authentication
                    // once the Microsoft authentication flow is confirmed.
                    navigate("/login", { replace: true });
                    return;
                }

                const account =
                    msalInstance.getActiveAccount() ||
                    msalInstance.getAllAccounts()[0];

                if (account) {
                    msalInstance.setActiveAccount(account);

                    navigate("/login", { replace: true });
                    return;
                }

                console.error("Microsoft authentication returned no account.");
                navigate("/login", {
                    replace: true,
                    state: {
                        microsoftError: "Microsoft authentication returned no account.",
                    },
                });
            } catch (err) {
                console.error("Microsoft callback failed:", err);

                navigate("/login", {
                    replace: true,
                    state: {
                        microsoftError:
                            err instanceof Error
                                ? err.message
                                : "Microsoft authentication failed.",
                    },
                });
            }
        };

        processMicrosoftLogin();
    }, [navigate]);

    return (
        <div>
            Signing in with Microsoft...
        </div>
    );
}

