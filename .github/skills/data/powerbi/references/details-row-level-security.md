# Row-Level Security Contracts

## Row-Level Security (RLS)

### Static RLS

```dax
-- In RLS role definition, filter Dim_Region
[Region] = USERPRINCIPALNAME()
```

### Dynamic RLS via Security Table

```
Dim_UserRegionAccess
| UserEmail           | Region    |
|---------------------|-----------|
| alice@contoso.com   | North     |
| alice@contoso.com   | South     |
| bob@contoso.com     | West      |
```

```dax
-- RLS filter expression on Dim_Region
[Region] IN
    SELECTCOLUMNS(
        FILTER(
            Dim_UserRegionAccess,
            Dim_UserRegionAccess[UserEmail] = USERPRINCIPALNAME()
        ),
        "Region", Dim_UserRegionAccess[Region]
    )
```

**Testing**: Always test RLS with "View as role" in Power BI Desktop and Service.
