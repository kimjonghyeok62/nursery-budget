import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 max-w-xl mx-auto mt-10 bg-red-50 border border-red-200 rounded-lg shadow-lg">
                    <h1 className="text-2xl font-bold text-red-700 mb-4">앗! 오류가 발생했습니다.</h1>
                    <p className="text-gray-700 mb-4">앱을 실행하는 도중 문제가 생겼습니다.</p>
                    <div className="bg-white p-4 rounded border border-red-100 overflow-auto text-xs font-mono text-red-600 mb-4 max-h-64">
                        <strong>{this.state.error && this.state.error.toString()}</strong>
                        <br />
                        <pre className="mt-2 text-gray-500 whitespace-pre-wrap">
                            {this.state.errorInfo && this.state.errorInfo.componentStack}
                        </pre>
                    </div>
                    <button
                        onClick={() => {
                            localStorage.clear();
                            window.location.reload();
                        }}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-medium transition-colors"
                    >
                        초기화 및 새로고침
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
