import { Component } from 'react';

export default class CanvasErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { error: false, errorMsg: '' };
    }

    static getDerivedStateFromError(error) {
        return { error: true, errorMsg: error.message || String(error) };
    }

    render() {
        if (this.state.error) {
            return (
                <div style={{
                    width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13
                }}>
                    {this.props.fallbackTitle || 'Interactive 3D visual paused on this device.'}
                </div>
            );
        }
        return this.props.children;
    }
}
