import * as React from 'react';

interface ILoadingContainerProps {
    isLoading: boolean;
    size?: number;
    children: React.ReactNode;
}

export const LoadingContainer: React.FC<ILoadingContainerProps> = ({ 
    isLoading, 
    size = 2, 
    children 
}) => {
    if (isLoading) {
        return (
            <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                minHeight: '200px' 
            }}>
                <div className="spinner-border" role="status">
                    <span className="sr-only">Loading...</span>
                </div>
            </div>
        );
    }
    return <>{children}</>;
};

export const notify = (message: string, type?: 'success' | 'error' | 'warning' | 'info') => {
    console.log(`[${type || 'info'}]: ${message}`);
    alert(`${type ? type.toUpperCase() + ': ' : ''}${message}`);
};