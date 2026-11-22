# Applications spreadsheet layout

The application export writes 26 Thai columns (A:Z). Original A:C, AD,
and AF:AK are removed, together with the English middle-name column.
Past-paper purchases use one item per line, and row heights resize to show the lines. Mock delivery reads the new positions for submission
time, applicant name, email, phone, and grade.

Application item IDs are stored as row developer metadata under
`ocecApplicationItemId`, so sorting or inserting rows does not change their
identity. Values and metadata for a new row are written in one batch.
Existing legacy tabs are migrated before the next sync. Unknown headers
stop migration to avoid deleting unrelated columns.

To update existing workbooks in the connected Google account:

```sh
node --env-file-if-exists=.env scripts/update-application-sheet-layout.js
node --env-file-if-exists=.env scripts/update-application-sheet-layout.js --apply
```

The first command previews the affected tabs. Applying verifies every retained
cell against its previous value. Repeating the command preserves the new layout.
The migration finds app-created workbooks in Drive as well as database mappings.
Sync reuses an existing workbook of the same year rather than creating a duplicate
when the mapping has not yet been saved locally.

On 2026-10-30, both HKISO and HKICO tabs in the existing OCEC Applications 2026
workbook were migrated and their retained rows verified.
