import * as React from 'react';

interface IInfoModalProps {
    id: string;
    title: string;
    backdrop?: 'static' | boolean;
    toShow: boolean;
    onClose: () => void;
    children: React.ReactNode;
}

const InfoModal: React.FC<IInfoModalProps> = ({ 
    id, 
    title, 
    backdrop, 
    toShow, 
    onClose, 
    children 
}) => {
    if (!toShow) return null;

    return (
        <div className="modal fade in" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog">
                <div className="modal-content">
                    <div className="modal-header">
                        <button 
                            type="button" 
                            className="close" 
                            onClick={onClose}
                            aria-label="Close"
                        >
                            <span aria-hidden="true">&times;</span>
                        </button>
                        <h4 className="modal-title">{title}</h4>
                    </div>
                    <div className="modal-body">
                        {children}
                    </div>
                    <div className="modal-footer">
                        <button 
                            type="button" 
                            className="btn btn-default" 
                            onClick={onClose}
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const Modal = {
    InfoModal
};