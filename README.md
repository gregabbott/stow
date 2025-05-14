Stow edits tables and stores tabular data in a JSON format. The GUI tool reads and writes local (gzipped) plain text files, runs offline in a browser as a single page app, and bundles everything into an HTML monofile under 50KB.

<details open><summary>Example Stow File Structure</summary>

```jsonc
{
 "meta": {
  "name": "Database name",
  "made": "Date database made",
  "note": " summary about the database",
  "last": "Date database last edited"
 },
 "form": {
  "name": ["c1 name","c2 name"],
  "note": ["c1 note","c2 note"],
  "type": ["c1 type","c2 type"], // any|string|boolean|number
  "sift": [1,0], // The on / off state for each column's filter
  "find": ["c1 query","c2 query"]// The current query per column
 },
 "list": [
  ["record 1 c1 value","record 1 c2 value"],
  ["record 2 c1 value","record 2 c2 value"]
 ]
}
```
</details>

- https://gregabbott.github.io/stow/
- https://gregabbott.pages.dev/stow/
