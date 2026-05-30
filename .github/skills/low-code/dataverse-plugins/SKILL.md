---
name: "dataverse-plugins"
description: 'Build Microsoft Dataverse server-side extensions in C# (.NET) -- plugins implementing IPlugin and custom workflow activities -- and register them via SdkMessageProcessingStep so an agent can add transactional business logic that runs inside the Dataverse event pipeline. Covers the execution context, pipeline stages, registration metadata, and pro-code-vs-low-code boundaries.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-05-30"
compatibility:
  surfaces: ["low-code-builder", "agent-x", "engineer"]
  platforms: ["power-platform", "dataverse", "dotnet", "csharp"]
---

# Dataverse Plugins (Server-Side .NET)

> Purpose: emit C# plugins / custom workflow activities and their registration so logic runs inside the Dataverse transaction -- the pro-code escape hatch when Power Automate / business rules cannot enforce a rule reliably.

## When to Use (and When Not To)

Use a plugin when you need synchronous, transactional, low-latency server enforcement:
- Cross-record validation that MUST block a save
- Derived/calculated values that must be set in the same transaction
- Integration that must commit-or-rollback with the record

Prefer low-code first: business rules (form logic), calculated/rollup columns, and Power Automate flows (async, no compile/deploy). A plugin adds a C# build, signing, and deployment pipeline -- only pay that cost when the low-code options cannot meet the requirement.

## The Event Pipeline

A plugin registers against a message + table + stage. Dataverse runs it when that message fires.

| Stage | Value | Runs | Use for |
|-------|-------|------|---------|
| PreValidation | 10 | Before the transaction | Cheap blocking validation, cross-table checks |
| PreOperation | 20 | In transaction, before main op | Mutate the inbound Target before save |
| PostOperation | 40 | In transaction, after main op | React to the saved record, write related rows |

Mode: **Synchronous** (blocks the call, can throw to roll back) or **Asynchronous** (background, cannot block the user).

## IPlugin

```csharp
public sealed class ValidateIssue : IPlugin
{
    public void Execute(IServiceProvider serviceProvider)
    {
        var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
        var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
        var service = factory.CreateOrganizationService(context.UserId);
        var tracing = (ITracingService)serviceProvider.GetService(typeof(ITracingService));

        if (context.InputParameters.TryGetValue("Target", out var t) && t is Entity target)
        {
            if (target.GetAttributeValue<string>("agx_name") is null or "")
            {
                throw new InvalidPluginExecutionException("Issue name is required.");  // rolls back
            }
            tracing.Trace("ValidateIssue passed for {0}", target.Id);
        }
    }
}
```

Contract:
- Plugin classes MUST be stateless (one instance serves many requests) -- never use instance fields for per-request data.
- Throw `InvalidPluginExecutionException` to surface a user-facing error and roll back a sync step.
- Read `context.Depth` and guard against infinite loops (your Update firing your own step again).
- Use `ITracingService` for diagnostics -- it surfaces in the plugin trace log.

## Registration (SdkMessageProcessingStep)

Steps are metadata, registered with the Plugin Registration Tool or `pac plugin`, and travel in a solution:

```
src/
  PluginAssemblies/<AssemblyName>/      # signed .dll + assembly metadata
  SdkMessageProcessingSteps/<step>.xml  # message=Create/Update, table, stage, mode, filtering attributes
```

Set **filtering attributes** on Update steps so the plugin only fires when relevant columns change -- not on every save.

## Custom Workflow Activities

For reusable steps invoked from Power Automate (legacy classic workflows / some flows), implement `CodeActivity` with `InArgument`/`OutArgument`. Same assembly, registered as a workflow activity rather than a step.

## Anti-Patterns

- Long-running or external HTTP calls in a synchronous step -- blocks the user and risks the 2-minute timeout; use async or a flow.
- No filtering attributes on Update -- the plugin runs on every column change, hurting throughput.
- Instance state on the plugin class -- cross-request data corruption.
- Re-implementing in C# what a business rule or flow already does -- unjustified pro-code cost.
- Ignoring `Depth` -- self-triggering recursion.

## Verify

```bash
dotnet build -c Release          # assembly must compile and be signed
pac plugin push ...              # register against a dev environment, exercise the message
```

## Related

- [power-automate-flow-json](../power-automate-flow-json/SKILL.md) -- async no-code alternative
- [dataverse-schema](../dataverse-schema/SKILL.md) -- the tables/columns plugins read and write
- [solution-anatomy](../solution-anatomy/SKILL.md) -- PluginAssemblies + step packaging