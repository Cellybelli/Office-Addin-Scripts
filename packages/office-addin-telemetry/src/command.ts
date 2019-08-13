import * as chalk from "chalk";
import * as commander from "commander";
import * as defaults from "./defaults";
import { telemetryEnabled } from "./officeAddinTelemetry";
import * as jsonData from "./telemetryJsonData";

export function listTelemetrySettings(): void {
   const telemetrySettings = jsonData.readTelemetrySettings(defaults.groupName);
   if (telemetrySettings) {
      console.log(chalk.default.blue(`\nTelemetry settings for ${defaults.groupName}:\n`));
      for (const value of Object.keys(telemetrySettings)) {
         console.log(`  ${value}: ${telemetrySettings[value]}\n`);
      }
   } else {
      console.log(chalk.default.red(`No telemetry settings for ${defaults.groupName}`));
   }
}

export function turnTelemetryOff(): void {
   setTelemetryLevel(telemetryEnabled.off);
}

export function turnTelemetryOn(): void {
   setTelemetryLevel(telemetryEnabled.on);
}

function setTelemetryLevel(level: telemetryEnabled) {
   try {
      jsonData.modifyTelemetryJsonData(defaults.groupName, "telemetryEnabled", level);
      console.log(chalk.default.green(`Telemetry enabled is now set to ${level}`));
   } catch (err) {
      throw new Error(`Error occurred while trying to change telemetry level`);
   }
}
