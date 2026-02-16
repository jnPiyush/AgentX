"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadAgentInstructions = loadAgentInstructions;
exports.loadAllAgentSummaries = loadAllAgentSummaries;
exports.clearInstructionCache = clearInstructionCache;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Cache of loaded agent instructions (markdown body, without frontmatter).
 * Keyed by agent filename. Cleared on refresh.
 */
const instructionCache = new Map();
/**
 * Load the markdown body (instructions) from an agent definition file.
 * Returns content after the YAML frontmatter closing '---', or undefined
 * if the file does not exist.
 */
async function loadAgentInstructions(agentx, agentFileName) {
    if (instructionCache.has(agentFileName)) {
        return instructionCache.get(agentFileName);
    }
    const root = agentx.workspaceRoot;
    if (!root) {
        return undefined;
    }
    const filePath = path.join(root, '.github', 'agents', agentFileName);
    if (!fs.existsSync(filePath)) {
        return undefined;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    // Extract everything after the closing frontmatter delimiter
    const firstDelim = content.indexOf('---');
    if (firstDelim === -1) {
        return undefined;
    }
    const fmEnd = content.indexOf('\n---', firstDelim + 3);
    if (fmEnd === -1) {
        return undefined;
    }
    const body = content.substring(fmEnd + 4).trim();
    instructionCache.set(agentFileName, body);
    return body;
}
/**
 * Load all agent summaries (name + description + fileName).
 */
async function loadAllAgentSummaries(agentx) {
    const agents = await agentx.listAgents();
    return agents.map(a => ({
        name: a.name,
        description: a.description,
        fileName: a.fileName,
    }));
}
/**
 * Clear the instruction cache. Call after refresh or reinitialization.
 */
function clearInstructionCache() {
    instructionCache.clear();
}
//# sourceMappingURL=agentContextLoader.js.map