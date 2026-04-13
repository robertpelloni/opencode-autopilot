#!/bin/bash
# Update versions and docs
sed -i 's/1.0.23/1.0.24/g' VERSION.md
sed -i 's/"version": "1.0.23"/"version": "1.0.24"/g' package.json
sed -i 's/"version": "1.0.23"/"version": "1.0.24"/g' packages/server/package.json
sed -i 's/"version": "1.0.23"/"version": "1.0.24"/g' packages/cli/package.json
sed -i 's/"version": "1.0.23"/"version": "1.0.24"/g' packages/shared/package.json

echo -e "\n## [1.0.24] - $(date +%Y-%m-%d)\n### Added\n- Comprehensive PROJECT_MEMORY.md documenting architecture and Go port status\n- Generated TODO.md mapping out remaining Go port tasks\n### Fixed\n- Resolved node-pty compilation issues in integration tests by implementing mock sidecars for TS testing\n" >> CHANGELOG.md

git add TODO.md VERSION.md package.json packages/*/package.json CHANGELOG.md
