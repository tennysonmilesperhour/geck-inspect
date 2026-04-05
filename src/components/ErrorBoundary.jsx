import React from 'react';

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error('ErrorBoundary caught:', error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
                    <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-xl p-8 text-center space-y-4">
                        <div className="text-5xl">🦎</div>
                        <h2 className="text-xl font-bold text-slate-100">Something went wrong</h2>
                        <p className="text-slate-400 text-sm">
                            An unexpected error occurred. Your data is safe — please refresh the page to continue.
                        </p>
                        {this.state.error?.message && (
                            <p className="text-xs text-slate-600 font-mono bg-slate-800 rounded p-2 text-left break-all">
                                {this.state.error.message}
                            </p>
                        )}
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-4 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            Reload Page
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}