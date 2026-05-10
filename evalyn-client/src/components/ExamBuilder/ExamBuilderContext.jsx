import { createContext, useContext } from 'react';

export const ExamBuilderContext = createContext({});

export const useEB = () => {
    const context = useContext(ExamBuilderContext);
    if (!context) {
        throw new Error("useEB must be used within an ExamBuilderContext Provider");
    }
    return context;
};
