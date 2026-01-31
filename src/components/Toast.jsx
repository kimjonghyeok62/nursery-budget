import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

const Toast = ({ message, type = 'success', onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    if (!message) return null;

    return (
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-6 py-4 rounded-xl shadow-xl border w-max max-w-[85vw] animate-in slide-in-from-bottom-5 fade-in duration-300 ${type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'
            }`}>
            {type === 'error' ? <AlertCircle size={24} /> : <CheckCircle size={24} />}
            <span className="font-bold text-lg whitespace-pre-line text-center flex-1">{message}</span>
            <button onClick={onClose} className="ml-2 hover:bg-black/5 rounded-full p-0.5">
                <X size={14} />
            </button>
        </div>
    );
};

export default Toast;
