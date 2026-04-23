"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const child_process_1 = require("child_process");
const diff_renderer_1 = require("./diff-renderer");
let backendProcess = null;
let currentPanel = undefined;
function activate(context) {
    console.log('Borg Orchestrator extension is now active!');
    // Start the Go backend binary
    const backendPath = path.join(context.extensionPath, '..', '..', 'go-port', 'bin', 'borg-server');
    if (fs.existsSync(backendPath)) {
        backendProcess = (0, child_process_1.spawn)(backendPath, [], { detached: true });
        backendProcess.stdout?.on('data', (data) => console.log(`[Borg Backend]: ${data.toString()}`));
        backendProcess.stderr?.on('data', (data) => console.error(`[Borg Backend ERR]: ${data.toString()}`));
    }
    else {
        vscode.window.showErrorMessage('Borg backend binary not found. Please run build:server in the workspace root.');
    }
    // Command 1: Open Dashboard
    let startCmd = vscode.commands.registerCommand('borg.startDashboard', () => {
        if (currentPanel) {
            currentPanel.reveal(vscode.ViewColumn.Two);
            return;
        }
        currentPanel = vscode.window.createWebviewPanel('borgDashboard', 'Borg Orchestrator', vscode.ViewColumn.Two, { enableScripts: true, retainContextWhenHidden: true });
        // Serve the public HTML dashboard, injecting the API_BASE to point to the local Go server
        const htmlPath = path.join(context.extensionPath, '..', '..', 'public', 'index.html');
        let html = fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath, 'utf-8') : '<h1>Dashboard missing</h1>';
        // Force API_BASE injection to ensure VS Code webview hits the local server
        const injection = `<script>window.API_BASE="http://localhost:3847";</script>`;
        html = html.replace('</head>', `${injection}</head>`);
        currentPanel.webview.html = html;
        currentPanel.onDidDispose(() => {
            currentPanel = undefined;
        }, null, context.subscriptions);
    });
    // Command 2: Debate Selected Code
    let debateCmd = vscode.commands.registerCommand('borg.debateSelection', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('No active editor open.');
            return;
        }
        const selection = editor.selection;
        const text = editor.document.getText(selection);
        if (!text) {
            vscode.window.showInformationMessage('Please select some code to debate.');
            return;
        }
        vscode.window.showInformationMessage('Sending code to the Borg Council for debate...');
        try {
            // Send to our local Go backend
            const response = await fetch('http://localhost:3847/api/council/debate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: `vscode-task-${Date.now()}`,
                    description: "Please review and suggest improvements for this code.",
                    context: text,
                    files: [editor.document.fileName]
                })
            });
            if (response.ok) {
                vscode.window.showInformationMessage('Borg Council consensus reached! Reviewing dashboard...');
                const data = await response.json();
                if (data && data.data && data.data.proposedCode) {
                    await (0, diff_renderer_1.presentDiff)(editor.document, text, data.data.proposedCode);
                }
                else {
                    vscode.commands.executeCommand('borg.startDashboard');
                }
            }
        }
        catch (e) {
            vscode.window.showErrorMessage('Failed to connect to Borg backend.');
        }
    });
    context.subscriptions.push(startCmd, debateCmd);
}
function deactivate() {
    if (backendProcess) {
        backendProcess.kill();
    }
}
//# sourceMappingURL=extension.js.map