import * as react_jsx_runtime from 'react/jsx-runtime';
import React from 'react';

interface AgenticWrapperProps {
    children: React.ReactNode;
    projectKey: string;
    apiHost?: string;
    debug?: boolean;
}
declare function AgenticWrapper({ children, projectKey, apiHost, debug }: AgenticWrapperProps): react_jsx_runtime.JSX.Element;

export { AgenticWrapper, type AgenticWrapperProps };
