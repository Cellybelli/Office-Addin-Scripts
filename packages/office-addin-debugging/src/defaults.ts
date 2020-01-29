// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as usageData from "office-addin-usage-data";

// Usage data defaults
export const usageDataProjectName: string = "office-addin-debugging";
export const sendUsageData: boolean = usageData.groupNameExists(usageData.groupName) && usageData.readUsageDataLevel(usageData.groupName) === usageData.UsageDataLevel.on;
export const usageDataOptions: usageData.IUsageDataOptions = {
    groupName: usageData.groupName,
    projectName: usageDataProjectName,
    raisePrompt: false,
    instrumentationKey: usageData.instrumentationKeyForOfficeAddinCLITools,
    promptQuestion: "",
    usageDataLevel: sendUsageData ? usageData.UsageDataLevel.on : usageData.UsageDataLevel.off,
    method: usageData.UsageDataReportingMethod.applicationInsights,
    isForTesting: false
}
