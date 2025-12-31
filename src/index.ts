import { Council } from './council.js';
import { MockSupervisor } from './supervisors/MockSupervisor.js';
import type { DevelopmentContext, CouncilConfig } from './types.js';

async function main() {
  console.log("Initializing OpenCode Autopilot Council...");

  const config: CouncilConfig = {
    supervisors: [
      {
        name: "Alpha-Mock",
        provider: "custom",
        modelName: "mock-v1"
      },
      {
        name: "Beta-Mock",
        provider: "custom",
        modelName: "mock-v1"
      }
    ],
    debateRounds: 2,
    autoContinue: false
  };

  const council = new Council(config);

  // Register Mock Supervisors
  config.supervisors.forEach(conf => {
    council.registerSupervisor(new MockSupervisor(conf));
  });

  await council.init();

  const mockContext: DevelopmentContext = {
    currentGoal: "Implement a basic CLI for the council.",
    recentChanges: ["Added Council class", "Added BaseSupervisor", "Added MockSupervisor"],
    fileContext: {
      "src/index.ts": "// Current file being written"
    },
    projectState: "Foundation Phase"
  };

  console.log("\n--- Starting Discussion ---");
  const guidance = await council.discuss(mockContext);
  
  console.log("\n--- Final Guidance ---");
  console.log(JSON.stringify(guidance, null, 2));
}

main().catch(console.error);
