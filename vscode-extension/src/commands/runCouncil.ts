import * as vscode from 'vscode';
import * as fs from 'fs';
import { AgentXContext } from '../agentxContext';
import {
  buildRolePrompt,
  CouncilRoleResult,
  CouncilRosterEntry,
  DiversityTier,
  getRoleInstruction,
  modelKey,
  modelSelectorCandidates,
  parseCouncilBrief,
  replaceRoleBlock,
  summarizeVendorDiversity,
} from './runCouncilInternals';

const COMMAND_ID = 'agentx.runCouncil';

interface LmModelLike {
  name?: string;
  family?: string;
  vendor?: string;
  sendRequest?(messages: unknown[], options?: unknown, token?: vscode.CancellationToken): Promise<{
    text?: AsyncIterable<unknown>;
  }>;
}

interface LmApi {
  selectChatModels?: (selector?: { vendor?: string; family?: string }) => Promise<LmModelLike[]>;
}

interface LmHostApi {
  lm?: LmApi;
  LanguageModelChatMessage?: { User?: (content: string) => unknown };
}

function getLmHostApi(): LmHostApi | undefined {
  const api = vscode as unknown as LmHostApi;
  if (!api.lm?.selectChatModels || !api.LanguageModelChatMessage?.User) { return undefined; }
  return api;
}

/**
 * Pick a model for one council role using a 3-tier diversity fallback:
 *   Tier 1 (vendor):  the role lands on a vendor not yet claimed by another
 *                     role -- the strongest diversity signal (independent
 *                     training data, RLHF, and outage isolation). Tried in
 *                     two passes: 1A honors the brief's requested
 *                     vendor/family selectors; 1B sweeps the full inventory
 *                     for ANY unclaimed vendor so mixed-availability
 *                     environments still recover vendor diversity even when
 *                     the requested vendor is missing.
 *   Tier 2 (model):   every available vendor has been used, but pick a
 *                     model identity (vendor+family+name) not yet claimed.
 *                     Within Tier 2, prefer a different family over a
 *                     different version of the same family (wider prior gap).
 *   Tier 3 (role):    even the model identity has been used. Last-resort
 *                     fallback so the council still produces 3 responses;
 *                     only the role instruction differentiates them. The
 *                     overall council diversity is reported as 'role' so
 *                     the calling agent can calibrate the synthesis.
 */
async function pickModel(
  api: LmHostApi,
  modelId: string,
  blockedVendors: ReadonlySet<string>,
  blockedModelKeys: ReadonlySet<string>,
  blockedFamilies: ReadonlySet<string>,
): Promise<{ model: LmModelLike; tier: DiversityTier } | undefined> {
  // --- Tier 1A: requested selectors, vendor-diverse ------------------------
  // Honor the requested vendor/family selectors and exclude vendors already
  // claimed by an earlier role. Best case: matches both the brief's intent
  // AND vendor independence.
  const strictCandidates = modelSelectorCandidates(modelId, { allowAnyFallback: false });
  for (const selector of strictCandidates) {
    try {
      const models = await api.lm!.selectChatModels!(selector);
      const filtered = (models ?? []).filter(
        (m) => !blockedVendors.has((m.vendor ?? '').trim().toLowerCase()),
      );
      if (filtered.length > 0) { return { model: filtered[0], tier: 'vendor' }; }
    } catch {
      // try next selector
    }
  }

  // --- Query the full inventory once for Tier 1B / 2 / 3 -------------------
  let allModels: LmModelLike[] = [];
  try {
    allModels = (await api.lm!.selectChatModels!({})) ?? [];
  } catch {
    return undefined;
  }
  if (allModels.length === 0) { return undefined; }

  // --- Tier 1B: any unclaimed vendor (even if family does not match) -------
  // Critical for mixed-availability environments. Example: brief asked for
  // anthropic/claude but only OpenAI and Google are installed. Tier 1A
  // failed (no anthropic), but if Google is unclaimed we should still get
  // vendor-level diversity rather than collapse to a duplicate OpenAI model.
  const unclaimedVendorModels = allModels.filter(
    (m) => !blockedVendors.has((m.vendor ?? '').trim().toLowerCase()),
  );
  if (unclaimedVendorModels.length > 0) {
    return { model: unclaimedVendorModels[0], tier: 'vendor' };
  }

  // --- Tier 2: model-diverse (vendor reused but model identity is fresh) ---
  const unusedModels = allModels.filter((m) => !blockedModelKeys.has(modelKey(m)));
  if (unusedModels.length > 0) {
    // Within Tier 2, prefer a different family over a different version of
    // an already-used family. Different family typically implies a wider
    // prior gap (e.g. gpt-5 vs gpt-4 > gpt-5.4 vs gpt-5.5).
    const differentFamily = unusedModels.filter(
      (m) => !blockedFamilies.has((m.family ?? '').trim().toLowerCase()),
    );
    const picked = differentFamily.length > 0 ? differentFamily[0] : unusedModels[0];
    return { model: picked, tier: 'model' };
  }

  // --- Tier 3: role-diverse-only (model identity reused) -------------------
  // The brief still gets 3 substantive responses because the role
  // instruction varies, but the council label is degraded so the synthesis
  // agent treats agreement between roles as weaker signal.
  return { model: allModels[0], tier: 'role' };
}

async function streamResponse(model: LmModelLike, prompt: string, token: vscode.CancellationToken): Promise<string> {
  const api = getLmHostApi();
  if (!api?.LanguageModelChatMessage?.User || !model.sendRequest) {
    throw new Error('Language model API unavailable');
  }
  const messages = [api.LanguageModelChatMessage.User(prompt)];
  const response = await model.sendRequest(messages, {}, token);
  if (!response?.text) { return ''; }

  let output = '';
  for await (const chunk of response.text as AsyncIterable<unknown>) {
    if (typeof chunk === 'string') {
      output += chunk;
      continue;
    }
    if (chunk && typeof chunk === 'object') {
      const value = (chunk as { value?: string; text?: string }).value
        ?? (chunk as { value?: string; text?: string }).text
        ?? '';
      output += value;
    }
  }
  return output.trim();
}

/**
 * Run a single role: dispatch the prompt to the already-selected model and
 * map success/failure into a CouncilRoleResult. Model selection happens
 * upstream so vendor-exclusion can be enforced sequentially across roles.
 */
async function runOneRole(
  entry: CouncilRosterEntry,
  model: LmModelLike,
  tier: DiversityTier,
  question: string,
  context: string,
  token: vscode.CancellationToken,
): Promise<CouncilRoleResult> {
  const prompt = buildRolePrompt({
    role: entry.role,
    // Fix Critical: use the brief's purpose-pack instruction when present so
    // adr-options / code-review / prd-scope / ai-design briefs do not get
    // silently downgraded to the generic research-pack instruction.
    roleInstruction: getRoleInstruction(entry.role, entry.instruction),
    question,
    context,
  });
  try {
    const response = await streamResponse(model, prompt, token);
    if (!response) {
      return {
        role: entry.role,
        model: entry.model,
        status: 'failed',
        error: 'Empty response from model',
        diversityTier: tier,
      };
    }
    const tag = `_Source: vscode.lm (vendor=${model.vendor ?? 'unknown'}, family=${model.family ?? 'unknown'}, tier=${tier})._`;
    return {
      role: entry.role,
      model: entry.model,
      status: 'ok',
      response: `${tag}\n\n${response}`,
      resolvedVendor: model.vendor,
      resolvedFamily: model.family,
      diversityTier: tier,
    };
  } catch (err) {
    return {
      role: entry.role,
      model: entry.model,
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
      diversityTier: tier,
    };
  }
}

async function resolveTargetUri(): Promise<vscode.Uri | undefined> {
  const active = vscode.window.activeTextEditor?.document;
  if (active && /COUNCIL-[^/\\]+\.md$/i.test(active.uri.fsPath)) {
    return active.uri;
  }
  const picked = await vscode.window.showOpenDialog({
    canSelectMany: false,
    filters: { 'Council briefs': ['md'] },
    title: 'Select Council Brief (COUNCIL-*.md)',
  });
  return picked?.[0];
}

/**
 * Refresh the in-memory editor view of the council brief without losing user
 * data. Safety contract:
 *   1. If the file is open AND has unsaved edits, prompt the user before any
 *      write so they can opt out instead of silently losing their changes.
 *   2. Only invoke `workbench.action.files.revert` when the council brief is
 *      the ACTIVE editor (otherwise revert hits the wrong document). When it
 *      is open but not active, focus it first via `showTextDocument` so the
 *      revert command targets the correct URI.
 *   3. When the file is not open at all, open it so the user can immediately
 *      see the council responses.
 */
async function refreshOpenEditor(target: vscode.Uri): Promise<void> {
  const opened = vscode.workspace.textDocuments.find((d) => d.uri.fsPath === target.fsPath);
  if (!opened) {
    await vscode.window.showTextDocument(target, { preview: false });
    return;
  }
  const active = vscode.window.activeTextEditor?.document;
  if (active?.uri.fsPath !== target.fsPath) {
    // Make the council brief the active editor so the revert command targets
    // it and not whichever other file the user happened to be on.
    await vscode.window.showTextDocument(opened, { preview: false, preserveFocus: false });
  }
  await vscode.commands.executeCommand('workbench.action.files.revert');
}

export function registerRunCouncilCommand(
  context: vscode.ExtensionContext,
  _agentx: AgentXContext,
): void {
  const cmd = vscode.commands.registerCommand(COMMAND_ID, async () => {
    const api = getLmHostApi();
    if (!api) {
      vscode.window.showErrorMessage(
        'AgentX: VS Code Language Model API is not available. The Run Council command requires GitHub Copilot Chat or another VS Code 1.95+ host that exposes vscode.lm.',
      );
      return;
    }

    const target = await resolveTargetUri();
    if (!target) { return; }

    let original: string;
    try {
      original = fs.readFileSync(target.fsPath, 'utf8');
    } catch (err) {
      vscode.window.showErrorMessage(`AgentX: Failed to read council brief: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    const brief = parseCouncilBrief(original);
    if (!brief.question || brief.roster.length === 0) {
      vscode.window.showErrorMessage(
        'AgentX: Council brief is missing a Question or Council Roster section. Generate it via scripts/model-council.ps1 first.',
      );
      return;
    }
    if (!brief.hasPendingRoles) {
      const proceed = await vscode.window.showWarningMessage(
        'No [AGENT-TODO] role placeholders remain in this brief. Re-run will overwrite existing role responses. Continue?',
        { modal: true },
        'Run anyway',
      );
      if (proceed !== 'Run anyway') { return; }
    }

    // Fix High: refuse to write if the council brief has unsaved edits in an
    // open editor. Otherwise the file write + revert sequence silently
    // discards the user's in-flight changes.
    const openedBefore = vscode.workspace.textDocuments.find(
      (d) => d.uri.fsPath === target.fsPath,
    );
    if (openedBefore?.isDirty) {
      const choice = await vscode.window.showWarningMessage(
        'AgentX Council: this brief has unsaved edits in the editor. Running the council will overwrite those edits with model responses.',
        { modal: true },
        'Discard edits and run',
      );
      if (choice !== 'Discard edits and run') { return; }
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'AgentX Council: consulting council members in parallel...',
        cancellable: true,
      },
      async (progress, token) => {
        // Fix High: select models SEQUENTIALLY with a 3-tier diversity
        // fallback (vendor -> model -> role) so the council degrades
        // gracefully instead of silently collapsing onto a single vendor
        // (or worse, a single model). Then run the actual sendRequest calls
        // in parallel for latency.
        const claimedVendors = new Set<string>();
        const claimedModelKeys = new Set<string>();
        const claimedFamilies = new Set<string>();
        const selections: Array<{
          entry: CouncilRosterEntry;
          model?: LmModelLike;
          tier?: DiversityTier;
        }> = [];
        for (const entry of brief.roster) {
          if (token.isCancellationRequested) { return; }
          const picked = await pickModel(
            api,
            entry.model,
            claimedVendors,
            claimedModelKeys,
            claimedFamilies,
          );
          if (picked) {
            const v = (picked.model.vendor ?? '').trim().toLowerCase();
            if (v) { claimedVendors.add(v); }
            claimedModelKeys.add(modelKey(picked.model));
            const f = (picked.model.family ?? '').trim().toLowerCase();
            if (f) { claimedFamilies.add(f); }
          }
          selections.push({ entry, model: picked?.model, tier: picked?.tier });
        }
        if (token.isCancellationRequested) { return; }

        const tasks = selections.map(async ({ entry, model, tier }): Promise<CouncilRoleResult> => {
          if (!model || !tier) {
            return {
              role: entry.role,
              model: entry.model,
              status: 'no-model',
              error: `No language model matched ${entry.model}`,
            };
          }
          return runOneRole(entry, model, tier, brief.question, brief.context, token);
        });
        const results = await Promise.all(tasks);
        if (token.isCancellationRequested) { return; }

        // Build a role -> instruction lookup so replaceRoleBlock can preserve
        // the per-role purpose-pack instruction across reruns. Without this,
        // a second pass loses the adr-options / code-review / prd-scope /
        // ai-design instruction when the original [AGENT-TODO] fenced block
        // is overwritten on the first pass.
        const instructionByRole = new Map<string, string | undefined>(
          brief.roster.map((entry) => [entry.role, entry.instruction]),
        );

        let updated = original;
        const failures: CouncilRoleResult[] = [];
        for (const result of results) {
          const instruction = instructionByRole.get(result.role);
          if (result.status === 'ok' && result.response) {
            updated = replaceRoleBlock(updated, result.role, result.response, instruction);
            progress.report({ message: `${result.role} responded.` });
          } else {
            failures.push(result);
            const placeholder = [
              `_Source: vscode.lm._`,
              '',
              `> [FAIL] Council member ${result.role} (${result.model}) did not respond: ${result.error ?? 'unknown error'}`,
              '> The calling agent should fall back to agent-internal completion for this role.',
            ].join('\n');
            updated = replaceRoleBlock(updated, result.role, placeholder, instruction);
          }
        }

        try {
          fs.writeFileSync(target.fsPath, updated, 'utf8');
        } catch (err) {
          vscode.window.showErrorMessage(`AgentX: Failed to write council brief: ${err instanceof Error ? err.message : String(err)}`);
          return;
        }

        await refreshOpenEditor(target);

        // Fix High: report diversity tier so a degraded council does not
        // silently look like a successful "multi-vendor" run. The tier
        // reflects the WORST role across the council:
        //   vendor -> all roles got distinct vendors (best)
        //   model  -> at least one role reused a vendor but with a fresh
        //             model identity (Tier 2 fallback)
        //   role   -> at least one role reused even the model identity;
        //             only the role instruction differentiates (Tier 3)
        const diversity = summarizeVendorDiversity(results);
        const okCount = results.length - failures.length;
        const vendorList = Array.from(diversity.vendors).join(', ') || 'none';

        if (failures.length === 0 && diversity.tier === 'vendor') {
          vscode.window.showInformationMessage(
            `AgentX Council: ${okCount}/${results.length} members responded across ${diversity.vendors.size} vendor(s) [${vendorList}] in vendor-diverse mode. Synthesis is the calling agent's responsibility.`,
          );
        } else if (diversity.tier === 'role') {
          // Tier 3: even model identity reused. Strongest warning.
          vscode.window.showWarningMessage(
            `AgentX Council: ${okCount}/${results.length} members responded but ran in role-diverse-only mode (vendor [${vendorList}], same model reused across roles). Treat agreement between roles as weak signal -- only the role instruction differentiates the responses. Install additional Copilot Chat model providers to recover diversity.`,
          );
        } else if (diversity.tier === 'model') {
          // Tier 2: vendor collapsed but at least the model identity varied.
          // Preserve the legacy "vendor diversity collapsed" / "multi-vendor
          // ... was NOT met" wording so existing operator runbooks and
          // regression tests still match.
          vscode.window.showWarningMessage(
            `AgentX Council: ${okCount}/${results.length} members responded in model-diverse mode -- vendor diversity collapsed (only [${vendorList}] available). The "multi-vendor" guarantee was NOT met; responses share one provider's biases. Install additional Copilot Chat model providers to recover.`,
          );
        } else if (failures.length === 0 && diversity.collapsed) {
          // Defensive: no tier resolved (shouldn't happen on a successful
          // run) but the vendor set still collapsed -- preserve legacy
          // wording for operator regression tests.
          vscode.window.showWarningMessage(
            `AgentX Council: ${okCount}/${results.length} members responded but vendor diversity collapsed (only [${vendorList}] available). The "multi-vendor" guarantee was NOT met -- responses share one provider's biases. Consider installing additional Copilot Chat model providers.`,
          );
        } else {
          vscode.window.showWarningMessage(
            `AgentX Council: ${okCount}/${results.length} members responded across ${diversity.vendors.size} vendor(s) [${vendorList}]. ${failures.length} failed (see brief for details).`,
          );
        }
      },
    );
  });

  context.subscriptions.push(cmd);
}
