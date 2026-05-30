# Solution.xml Skeleton (Reference)

The low-code-builder emits `src/Other/Solution.xml` shaped like the block below. Substitute the bracketed values.

`xml
<?xml version="1.0" encoding="utf-8"?>
<ImportExportXml version="9.2.0.0" SolutionPackageVersion="9.2" languagecode="1033" generatedBy="agentx-low-code-builder" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <SolutionManifest>
    <UniqueName>[prefix]_[solution_short_name]</UniqueName>
    <LocalizedNames>
      <LocalizedName description="[Display Name]" languagecode="1033" />
    </LocalizedNames>
    <Descriptions>
      <Description description="[One paragraph]" languagecode="1033" />
    </Descriptions>
    <Version>1.0.0.0</Version>
    <Managed>0</Managed>
    <Publisher>
      <UniqueName>[publisher_unique_name]</UniqueName>
      <LocalizedNames>
        <LocalizedName description="[Publisher Display Name]" languagecode="1033" />
      </LocalizedNames>
      <Descriptions>
        <Description description="[Publisher Description]" languagecode="1033" />
      </Descriptions>
      <EMailAddress xsi:nil="true" />
      <SupportingWebsiteUrl xsi:nil="true" />
      <CustomizationPrefix>[prefix]</CustomizationPrefix>
      <CustomizationOptionValuePrefix>10000</CustomizationOptionValuePrefix>
      <Addresses />
    </Publisher>
    <RootComponents>
      <!-- One <RootComponent> per included component -->
      <!-- type=1 Entity, type=2 Attribute, type=9 OptionSet, type=29 Workflow, type=80 ConnectionReference, type=300 CanvasApp -->
      <RootComponent type="1" schemaName="[prefix]_issue" behavior="0" />
      <RootComponent type="2" schemaName="[prefix]_issue.[prefix]_name" behavior="0" />
      <RootComponent type="29" schemaName="[flow-guid]" behavior="0" />
      <RootComponent type="80" schemaName="[prefix]_sharedoffice365" behavior="0" />
    </RootComponents>
    <MissingDependencies />
  </SolutionManifest>
</ImportExportXml>
`

## RootComponent type reference (most common)

| type | Component |
|------|-----------|
| 1 | Entity (table) |
| 2 | Attribute (column) |
| 9 | Option Set (global choice) |
| 20 | Security Role |
| 29 | Workflow / Cloud Flow |
| 60 | System Form |
| 61 | Web Resource |
| 80 | Connection Reference |
| 300 | Canvas App |
| 371 | Environment Variable Definition |

## Version Bump Rule

- New solution: `1.0.0.0`
- Additive regeneration: bump `REVISION` (`1.0.0.1`, `1.0.0.2`)
- Breaking schema change: bump `BUILD` (`1.0.1.0`) and document in `Description`

See `.github/skills/low-code/solution-anatomy/SKILL.md` for the full rules.