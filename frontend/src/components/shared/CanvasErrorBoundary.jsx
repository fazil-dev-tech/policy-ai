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
                <div style={{ color: 'red', padding: 20, background: 'black' }}>
                    WebGL Crash: {this.state.errorMsg}
                </div>
            );
        }
        return this.props.children;
    }
}
