using System.Threading;
using System.Threading.Tasks;
using Microsoft.VisualStudio.Extensibility;
using Microsoft.VisualStudio.Extensibility.Settings;

namespace AgentX.VisualStudio.Settings;

/// <summary>
/// AgentX settings. Mirrors the VS Code extension's <c>agentx.*</c> configuration
/// keys so behavior is identical across IDEs.
/// </summary>
/// <remarks>
/// VS Extensibility 17.14 requires:
///   * Setting and category IDs to start with a lowercase letter and contain
///     only alphanumerics. We use <c>"agentX"</c> for the category and
///     <c>"autoRefresh"</c>, <c>"shell"</c>, ... for individual settings.
///   * <see cref="Setting.Enum"/> to be the non-generic form whose options
///     are <see cref="EnumSettingEntry"/> instances.
///   * <c>ReadEffectiveValueAsync</c> returns a <see cref="SettingValue{T}"/>;
///     use <c>ValueOrDefault(...)</c> to materialize the actual value.
/// </remarks>
internal static class AgentXSettings
{
    public const string ShellAuto = "auto";
    public const string ShellPwsh = "pwsh";
    public const string ShellBash = "bash";

    [VisualStudioContribution]
    public static SettingCategory Category { get; } = new("agentX", "%AgentX.Settings.Category%");

    [VisualStudioContribution]
    public static Setting.Boolean AutoRefresh { get; } = new(
        "autoRefresh",
        "%AgentX.Settings.AutoRefresh.DisplayName%",
        Category,
        defaultValue: true)
    {
        Description = "%AgentX.Settings.AutoRefresh.Description%",
    };

    [VisualStudioContribution]
    public static Setting.Enum Shell { get; } = new(
        "shell",
        "%AgentX.Settings.Shell.DisplayName%",
        Category,
        new EnumSettingEntry[]
        {
            new(ShellAuto, "%AgentX.Settings.Shell.Auto%"),
            new(ShellPwsh, "%AgentX.Settings.Shell.Pwsh%"),
            new(ShellBash, "%AgentX.Settings.Shell.Bash%"),
        },
        defaultValue: ShellAuto)
    {
        Description = "%AgentX.Settings.Shell.Description%",
    };

    [VisualStudioContribution]
    public static Setting.String RootPath { get; } = new(
        "rootPath",
        "%AgentX.Settings.RootPath.DisplayName%",
        Category,
        defaultValue: string.Empty)
    {
        Description = "%AgentX.Settings.RootPath.Description%",
    };

    [VisualStudioContribution]
    public static Setting.Integer SearchDepth { get; } = new(
        "searchDepth",
        "%AgentX.Settings.SearchDepth.DisplayName%",
        Category,
        defaultValue: 2)
    {
        Description = "%AgentX.Settings.SearchDepth.Description%",
    };

    [VisualStudioContribution]
    public static Setting.Boolean SkipStartupCheck { get; } = new(
        "skipStartupCheck",
        "%AgentX.Settings.SkipStartupCheck.DisplayName%",
        Category,
        defaultValue: false)
    {
        Description = "%AgentX.Settings.SkipStartupCheck.Description%",
    };

    [VisualStudioContribution]
    public static Setting.Boolean SkipUpdateCheck { get; } = new(
        "skipUpdateCheck",
        "%AgentX.Settings.SkipUpdateCheck.DisplayName%",
        Category,
        defaultValue: false)
    {
        Description = "%AgentX.Settings.SkipUpdateCheck.Description%",
    };

    /// <summary>
    /// Reads the <see cref="Shell"/> setting and returns the canonical value
    /// (one of <see cref="ShellAuto"/>, <see cref="ShellPwsh"/>, <see cref="ShellBash"/>).
    /// </summary>
    public static async Task<string> ReadShellAsync(
        VisualStudioExtensibility extensibility,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await extensibility.Settings()
                .ReadEffectiveValueAsync(Shell, cancellationToken)
                .ConfigureAwait(false);
            var raw = result.ValueOrDefault(defaultValue: ShellAuto);
            return string.IsNullOrWhiteSpace(raw) ? ShellAuto : raw;
        }
        catch
        {
            // Fail open: a missing or unreadable setting should not break the CLI.
            return ShellAuto;
        }
    }

    /// <summary>
    /// Reads <see cref="RootPath"/> using the effective value, returning an empty
    /// string when the setting is unset or unreadable.
    /// </summary>
    public static async Task<string> ReadRootPathAsync(
        VisualStudioExtensibility extensibility,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await extensibility.Settings()
                .ReadEffectiveValueAsync(RootPath, cancellationToken)
                .ConfigureAwait(false);
            return result.ValueOrDefault(defaultValue: string.Empty) ?? string.Empty;
        }
        catch
        {
            return string.Empty;
        }
    }

    /// <summary>Reads <see cref="SearchDepth"/> with a safe default.</summary>
    public static async Task<int> ReadSearchDepthAsync(
        VisualStudioExtensibility extensibility,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await extensibility.Settings()
                .ReadEffectiveValueAsync(SearchDepth, cancellationToken)
                .ConfigureAwait(false);
            var raw = result.ValueOrDefault(defaultValue: 2);
            return raw < 0 ? 0 : raw;
        }
        catch
        {
            return 2;
        }
    }

    /// <summary>Reads <see cref="AutoRefresh"/> with a safe default of <c>true</c>.</summary>
    public static async Task<bool> ReadAutoRefreshAsync(
        VisualStudioExtensibility extensibility,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await extensibility.Settings()
                .ReadEffectiveValueAsync(AutoRefresh, cancellationToken)
                .ConfigureAwait(false);
            return result.ValueOrDefault(defaultValue: true);
        }
        catch
        {
            return true;
        }
    }
}

