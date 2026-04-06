# Project Instructions

## Git / Push Rules
- **Never push to the upstream repo** (`zalify/easy-email-editor`). Only push to the fork at `origin` (`4site-interactive-studios/easy-email-editor`).
- When creating PRs, always target the fork's branches — never open PRs against the upstream repository.

## Project Overview
This is a forked MJML email editor built for non-profit professionals. It's a visual drag-and-drop email builder that stores content as a block tree (`IBlockData`) and renders it as MJML for compilation to HTML.

### Architecture
- **`packages/easy-email-core`** — Block types, `JsonToMjml`, `getAdapterAttributesString`, block data utilities
- **`packages/easy-email-editor`** — Visual editor, shadow DOM rendering, focus/hover system, `useBlock` hook
- **`packages/easy-email-extensions`** — `SimpleLayout`, `BlockLayer`, `AttributePanel`, `MjmlToJson`, `parseXMLtoBlock`, interactive prompts
- **`demo/`** — The application layer: Editor page, Home page, Settings, components (BlockInsertButtons, BlockMjmlEditor, Tooltip, etc.)
- **`server/`** — SQLite backend (`better-sqlite3`), REST API, WebSocket collaboration

### Key Data Flow
1. **Import**: MJML string → `parseXMLtoBlockFidelity()` (DOM parser, source fidelity) → `IBlockData` tree
2. **Code→Visual**: MJML string → `MjmlToJson()` → `parseXMLtoBlock()` (mjml-browser parser, merges defaults) → `IBlockData` tree
3. **Visual→Code**: `IBlockData` tree → `JsonToMjml()` → MJML string
4. **Render**: `IBlockData` → each block's `render()` → `BasicBlock` → `getAdapterAttributesString()` → MJML tags

### Two Parsing Paths (Critical!)
- **`parseXMLtoBlock(text)`** — Uses mjml-browser for full `<mjml>` documents. Calls `block.create(payload)` which merges editor defaults. Used for Code→Visual round-trips.
- **`parseXMLtoBlockFidelity(text)`** — Uses DOM-based parser. Does NOT merge defaults. Preserves source attributes exactly. Used for "Import MJML" on the home page.

## Test Fixture
A comprehensive test MJML template is available at `test-fixtures/test-template.mjml`. It covers:
- `<mj-title>`, `<mj-preview>`, `<mj-breakpoint>`
- `<mj-attributes>` with global defaults, `<mj-class>` declarations, and HTML comments
- `<mj-style>` with CSS including media queries
- `<mj-raw>` with meta tags and MSO conditionals
- `<mjml lang="en">` root attribute
- Body elements: sections, columns, wrappers, groups, text, images, buttons, spacers, dividers
- HTML entities: `&rsquo;`, `&rarr;`, `&bull;`, `&amp;`, `&copy;`
- URLs with `&` query parameters
- `mj-class` references on elements
- `css-class` attributes
- Two-column layouts
- Background images and colors
- Nested wrappers

### Using the Test Fixture
When making changes to parsing, rendering, or round-trip logic, test with this template:

```bash
# Quick smoke test — import and re-export should produce equivalent MJML
cat test-fixtures/test-template.mjml
# Paste into "Import MJML" on the home page, then check Code mode output
```

**Key round-trip checks:**
1. `<mj-attributes>` declarations preserved (not empty)
2. `<mj-class>` definitions intact
3. `<mj-title>` and `<mj-preview>` present
4. `lang="en"` on root `<mjml>` element
5. HTML entities not double-encoded (`&` should not become `&amp;amp;`)
6. `<mj-raw>` content (meta tags, MSO conditionals) preserved
7. Visual→Code→Visual produces identical visual rendering
8. No spurious default attributes injected (padding, border, direction)

## Testing

### Running Tests
```bash
# Core package tests
cd packages/easy-email-core && pnpm run test

# Extensions package tests (includes MjmlToJson, parseXMLtoBlock)
cd packages/easy-email-extensions && pnpm run test
```

### Test Locations
- `packages/easy-email-core/src/utils/__tests__/` — JsonToMjml, block utilities
- `packages/easy-email-extensions/src/utils/__tests__/` — MjmlToJson, parseXMLtoBlock

### Writing Tests
When adding features, write tests that cover:
1. **Import fidelity** — MJML source attributes are preserved after import via `parseXMLtoBlockFidelity`
2. **Round-trip correctness** — Visual→Code→Visual produces the same block data
3. **Edge cases** — HTML entities, comments in `<mj-attributes>`, empty attributes, `mj-raw` content
4. **Block operations** — move, copy, delete, insert with comment blocks

### Test Patterns
```typescript
import { MjmlToJson } from '../MjmlToJson';
import { parseXMLtoBlockFidelity } from '../parseXMLtoBlock';
import { JsonToMjml } from 'easy-email-core';

// Round-trip test
it('should preserve styling through Code→Visual round-trip', () => {
  const mjml = '<mjml>...</mjml>';
  const parsed = MjmlToJson(mjml);                    // mjml-browser path
  const output = JsonToMjml({ data: parsed, mode: 'production', context: parsed });
  const reparsed = MjmlToJson(output);
  expect(reparsed).toEqual(parsed);                    // Block data matches
});

// Import fidelity test
it('should preserve source attributes on import', () => {
  const mjml = '<mjml>...</mjml>';
  const parsed = parseXMLtoBlockFidelity(mjml);
  const output = JsonToMjml({ data: parsed, mode: 'production', context: parsed });
  expect(output).not.toContain('background-repeat');   // No injected defaults
});
```

## Self-Updating Instructions
When making significant architectural changes, update this file to reflect:
- New parsing paths or data flow changes
- New utilities or components that future work should know about
- Changed file locations or removed features
- New test patterns or fixtures needed

## Common Pitfalls
- **Don't strip metadata in Code mode** — The code editor needs full MJML for correct round-tripping. Only strip for exports.
- **Two parser paths exist** — `parseXMLtoBlock` (mjml-browser, merges defaults) vs `parseXMLtoBlockFidelity` (DOM, preserves source). Using the wrong one breaks either round-trips or import fidelity.
- **`encodeXmlAttr` in `getAdapterAttributesString`** — Encodes `&`, `<`, `>`, `"` in all attribute values. Source MJML with bare `&` in URLs will be encoded to `&amp;` on output.
- **Comments in `<mj-attributes>`** — mjml-browser handles them; the DOM parser may not. Don't wrap/unwrap comments when round-tripping.
- **`block.create(payload)` merges defaults** — This is correct for the editor (Code→Visual) but wrong for imports (use direct IBlockData construction instead).
- **Shadow DOM** — The visual editor renders inside `#VisualEditorEditMode` shadow root. DOM queries need `getBlockNodeByIdx()` or `getShadowRoot()`.
- **`generaMjmlMetaData`** — Outputs `<mj-html-attributes>` for editor metadata. Returns empty string when no metadata fields exist (fresh imports).

## Dev Server
```bash
# Start the backend (port 3100)
cd server && node index.js

# Start the frontend (port 3200)
cd demo && pnpm run dev

# Or use the preview server config
# .claude/launch.json has the configuration
```
