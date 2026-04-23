"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.presentDiff = presentDiff;
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const os = require("os");
async function presentDiff(document, originalCode, proposedCode, title = "Borg Council Proposed Changes") {
    // Write the proposed code to a temporary file
    const tempDir = os.tmpdir();
    const tempFileName = `borg-proposal-${Date.now()}.txt`;
    const tempFilePath = path.join(tempDir, tempFileName);
    fs.writeFileSync(tempFilePath, proposedCode, 'utf8');
    // Generate URI for the temp file
    const tempUri = vscode.Uri.file(tempFilePath);
    // Generate URI for the active document
    const docUri = document.uri;
    // Use built-in vscode diff viewer
    await vscode.commands.executeCommand('vscode.diff', docUri, tempUri, title);
    // Clean up temp file when editor is closed
    const disposable = vscode.workspace.onDidCloseTextDocument(doc => {
        if (doc.uri.fsPath === tempFilePath) {
            try {
                fs.unlinkSync(tempFilePath);
            }
            catch (e) {
                console.error(`Failed to delete temp file ${tempFilePath}:`, e);
            }
            disposable.dispose();
        }
    });
}
//# sourceMappingURL=diff-renderer.js.map