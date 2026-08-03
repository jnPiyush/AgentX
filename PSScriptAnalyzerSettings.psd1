# PSScriptAnalyzer configuration for AgentX.
#
# Rule selection rationale -- AgentX is a CLI tool, not a module library, so
# several default rules produce noise rather than signal:
#
#   PSAvoidUsingWriteHost      652 hits. Console output IS the product for a
#                              CLI. Excluded.
#   PSUseSingularNouns          38 hits. Naming style only.
#   PSReviewUnusedParameter     71 hits. High false-positive rate on
#                              splatting and pipeline-bound params.
#   PSUseShouldProcessForState-  23 hits. -WhatIf/-Confirm ceremony is not
#   ChangingFunctions          appropriate for internal CLI helpers.
#   PSUseApprovedVerbs           4 hits. Style only.
#   PSUseBOMForUnicodeEncodedFile  Conflicts with the repository ASCII-only rule.
#
# What remains are defect and security classes. See
# scripts/run-psscriptanalyzer.ps1 for how they are enforced.

@{
    Severity = @('Error', 'Warning')

    IncludeRules = @(
        # --- Security critical: zero tolerance in production paths ---
        'PSAvoidUsingInvokeExpression'
        'PSAvoidUsingPlainTextForPassword'
        'PSAvoidUsingConvertToSecureStringWithPlainText'
        'PSAvoidUsingUsernameAndPasswordParams'
        'PSUsePSCredentialType'
        'PSAvoidUsingComputerNameHardcoded'

        # --- Defect classes: ratcheted against a committed baseline ---
        'PSPossibleIncorrectComparisonWithNull'
        'PSAvoidUsingEmptyCatchBlock'
        'PSAvoidAssignmentToAutomaticVariable'
        'PSUseDeclaredVarsMoreThanAssignments'
        'PSUseUsingScopeModifierInNewRunspaces'
        'PSAvoidGlobalVars'
        'PSMissingModuleManifestField'
        'PSAvoidDefaultValueSwitchParameter'
        'PSAvoidNullOrEmptyHelpMessageAttribute'
        'PSUseLiteralInitializerForHashtable'
    )
}
