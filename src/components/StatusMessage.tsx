interface StatusMessageProps {
    status: { success: boolean; message: string } | null;
    isPaused: boolean;
}

export function StatusMessage({ status, isPaused }: StatusMessageProps) {
    if (!status) return null;

    return (
        <div className={`status-message ${isPaused ? 'warning' : (status.success ? 'success' : 'error')}`}>
            {status.success && !isPaused && (
                <svg className="success-icon" viewBox="0 0 24 24" width="16" height="16">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                </svg>
            )}
            <p>{status.message}</p>
        </div>
    );
}
