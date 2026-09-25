import { createContext, useContext } from "react";
import { FetchWorker } from "./FetchWorkerShared.ts";

const FetchWorkerContext = createContext<FetchWorker | null>(null);

export const FetchWorkerProvider = ({
    worker,
    children
}: {
    worker: FetchWorker;
    children: React.ReactNode;
}) => {
    return (
        <FetchWorkerContext.Provider value={worker}>
            {children}
        </FetchWorkerContext.Provider>
    );
};

export const useFetchWorker = () => {
    const worker = useContext(FetchWorkerContext);

    if (!worker) {
        throw new Error("useFetchWorker must be used inside FetchWorkerProvider");
    }

    return worker;
};