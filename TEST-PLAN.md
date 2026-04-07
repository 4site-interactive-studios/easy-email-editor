# Comprehensive Feature & Functionality Inventory for Unit Testing

This document catalogs every feature, function, component, hook, and utility in the easy-email-editor project. It is organized by package/module with testable behaviors, edge cases, and data flows documented for each item.

---

## Table of Contents

1. [Test Infrastructure](#test-infrastructure)
2. [Package: easy-email-core](#package-easy-email-core)
3. [Package: easy-email-editor](#package-easy-email-editor)
4. [Package: easy-email-extensions](#package-easy-email-extensions)
5. [Demo Application](#demo-application)
6. [Server](#server)
7. [Cross-Cutting Concerns & Integration Flows](#cross-cutting-concerns)

---

## Test Infrastructure

### Framework
- **Jest** with jsdom environment
- **Babel** transform: `@babel/preset-react`, `@babel/preset-env`, `@babel/preset-typescript`
- **Snapshot testing** for MJML/JSON output validation
- **Style mocks**: CSS/SCSS imports return empty modules

### Running Tests
```bash
pnpm run test           # All packages
pnpm run test:core      # packages/easy-email-core only
pnpm run test:extensions # packages/easy-email-extensions only
```

### Existing Test Files
- `packages/easy-email-core/src/utils/__tests__/` — 10 test files (JsonToMjml, block, ancestorOf, createBlockDataByType, etc.)
- `packages/easy-email-extensions/src/utils/__tests__/` — 2 test files (MjmlToJson, parseXMLtoBlock)
- Test fixture: `test-fixtures/test-template.mjml` — comprehensive MJML template

---

## Package: easy-email-core

### 1. Block Types & Constants

#### `BasicType` Enum
All standard MJML block types:
```
PAGE, SECTION, COLUMN, GROUP, TEXT, IMAGE, DIVIDER, SPACER,
BUTTON, WRAPPER, RAW, ACCORDION, ACCORDION_ELEMENT,
ACCORDION_TITLE, ACCORDION_TEXT, HERO, CAROUSEL, NAVBAR,
SOCIAL, TABLE, TEMPLATE
```

#### `AdvancedType` Enum
Extended blocks with iteration/condition support:
```
TEXT, IMAGE, DIVIDER, SPACER, BUTTON, NAVBAR, SOCIAL,
ACCORDION, CAROUSEL, TABLE, WRAPPER, SECTION, COLUMN,
GROUP, HERO
```

**Testable**: Enum completeness, no duplicate values, naming conventions.

---

### 2. Block Definitions (src/blocks/)

Each block defines:
- `name` — display name
- `type` — unique identifier
- `create(payload?)` — factory that returns `IBlockData` with defaults
- `validParentType[]` — allowed parent block types
- `render(params)` — renders to MJML string via React SSR

#### Block Hierarchy & Valid Parents

| Block | Valid Parents | Valid Children |
|-------|-------------|---------------|
| Page | (root) | Wrapper |
| Wrapper | PAGE | Section |
| Section | PAGE, WRAPPER | Column, Group |
| Column | SECTION, GROUP | Text, Image, Button, Divider, Spacer, Raw, Carousel, Navbar, Social, Table, Accordion, Hero |
| Group | SECTION | Column |
| Hero | PAGE, WRAPPER | Text, Button, Image |
| Text | COLUMN, HERO | (none) |
| Image | COLUMN, HERO | (none) |
| Button | COLUMN, HERO | (none) |
| Divider | COLUMN, HERO | (none) |
| Spacer | COLUMN, HERO | (none) |
| Raw | PAGE, WRAPPER, SECTION, GROUP, COLUMN, HERO | (none) |
| Carousel | COLUMN, HERO | (none) |
| Navbar | SECTION, COLUMN, HERO | (none) |
| Social | COLUMN, HERO | (none) |
| Table | COLUMN | (none) |
| Accordion | COLUMN | AccordionElement |
| AccordionElement | ACCORDION | AccordionTitle, AccordionText |
| AccordionTitle | ACCORDION_ELEMENT | (none) |
| AccordionText | ACCORDION_ELEMENT | (none) |

**Testable behaviors per block**:
- `create()` returns valid IBlockData with correct type, default attributes, empty children array
- `create(payload)` merges payload into defaults without losing required fields
- `validParentType` is correct (test each block can be placed in each valid parent)
- `render()` produces correct MJML tag name
- `render()` includes all non-default attributes
- `render()` handles empty/missing attributes gracefully

#### Page Block Special Properties
- `IPage.data.value` contains: `breakpoint`, `headAttributes`, `fonts[]`, `headStyles[]`, `extraHeadContent`, `responsive`, `font-family`, `font-size`, `line-height`, `text-color`, `user-style`, `content-background-color`, `mjmlAttributes`
- Renders full `<mjml><mj-head>...<mj-body>...</mj-body></mjml>` structure
- **Testable**: headAttributes rendering, font injection, style injection, responsive flag, breakpoint tag

#### Content Block Value Properties
- **Text**: `value.content` (HTML string)
- **Button**: `value.content` (label text)
- **Raw**: `value.content` (raw HTML)
- **Image**: attributes only (src, alt, href, etc.)
- **Carousel**: `value.images[]` (src, href, alt per image)
- **Social**: `value.elements[]` (content, src, href per element)
- **Table**: `value.content` (HTML table string)
- **Accordion***: `value.content` for title and text children

---

### 3. Advanced Blocks (src/blocks/advanced/)

#### `generateAdvancedBlock(option)`
Factory for blocks with iteration/condition support.

**Testable**:
- Creates block with correct `type` matching AdvancedType
- Includes iteration config: `{ enabled, dataSource, itemName, limit, mockQuantity }`
- Includes condition config: `{ enabled, groups[], symbol: 'AND' | 'OR' }`
- Condition operators: `TRUTHY, FALSY, ==, !=, >, >=, <, <=`

#### `generateAdvancedContentBlock<T>()`
- Auto-wraps content in Section+Column when parent is PAGE/WRAPPER
- **Testable**: Auto-wrapping behavior, preserves original block data

#### `generateAdvancedLayoutBlock<T>()`
- Sets column width to 100% if iteration enabled
- **Testable**: Width override when iterated

#### `generateAdvancedTableBlock()`
- `tableSource`: 2D array of `{ content, colSpan?, rowSpan?, backgroundColor? }`
- **Testable**: Table HTML generation, cell spanning, background colors

#### Template Engine (Liquid Syntax)
- **Iteration**: `{% for item in collection limit:n %} ... {% endfor %}`
- **Condition**: `{% assign %} {% if %} ... {% endif %}`
- **Testable**: Correct Liquid output for various condition/iteration configs

---

### 4. Block Navigation Utilities (src/utils/block.ts)

| Function | Signature | Description | Test Cases |
|----------|-----------|-------------|------------|
| `getPageIdx()` | `() → 'content'` | Returns root index | Always returns 'content' |
| `getChildIdx(idx, index)` | `(string, number) → string` | Path to child | `('content', 0)` → `'content.children.[0]'` |
| `getNodeIdxClassName(idx)` | `(string) → string` | CSS class from index | Deterministic output |
| `getNodeTypeClassName(type)` | `(string) → string` | CSS class from type | Maps all BasicType values |
| `getNodeIdxFromClassName(classList)` | `(DOMTokenList) → string?` | Extract idx from class | With/without matching class |
| `getNodeTypeFromClassName(classList\|string)` | → `BlockType?` | Extract type from class | Valid/invalid class strings |
| `getIndexByIdx(idx)` | `(string) → number` | Array index from path | `'content.children.[2]'` → `2` |
| `getParentIdx(idx)` | `(string) → string?` | Parent path | Root returns undefined, nested returns parent |
| `getValueByIdx(values, idx)` | `(obj, string) → T?` | Deep get | Valid/invalid paths, deeply nested |
| `getParentByIdx(values, idx)` | `(obj, string) → T?` | Parent block | Edge: root block has no parent |
| `getSiblingIdx(sourceIndex, num)` | `(string, number) → string` | Sibling path | +1, -1, boundary cases |
| `getParentByType(context, idx, type)` | → `T?` | Walk up to find type | Direct parent, grandparent, not found |
| `getSameParent(values, idx, dragType)` | → `{parent, parentIdx}?` | Find common parent for drag | Same parent, different parents, root |
| `getParenRelativeByType(context, idx, type)` | → `{parentIdx, insertIndex, parent}?` | Relative parent for insert | Complex nesting |
| `getValidChildBlocks(type)` | `(string) → IBlock[]` | Valid children | Each block type returns correct set |
| `ancestorOf(type, targetType)` | → `number` | Ancestry level | Direct (1), indirect (2+), not ancestor (-1), same type (-1) |

---

### 5. BlockManager (Static Class)

| Method | Test Cases |
|--------|------------|
| `registerBlocks(map)` | Adds blocks to registry, doesn't remove existing |
| `getBlockByType(type)` | Returns block or undefined for unknown type |
| `getBlocks()` | Returns all registered blocks |
| `getBlocksByType(types)` | Returns array matching order, undefined for missing |
| `getAutoCompleteFullPath()` | Returns all valid ancestor paths per type |
| `getAutoCompletePath(type, targetType)` | Returns shortest path or null |

---

### 6. JsonToMjml (src/utils/JsonToMjml.tsx)

**Signature**: `JsonToMjml(options: { data, mode, beautify?, dataSource?, context? }) → string`

**Test cases**:
- Production mode: no CSS classes added
- Testing mode: adds `email-block`, node-idx, node-type classes
- Beautify: formats output with indentation
- DataSource: template variables interpolated
- Context: ancestor context available for rendering
- Hidden blocks: `data.hidden = true` → block not rendered
- Placeholder images: empty/merge-tag src replaced in testing mode
- Recursive rendering: deeply nested blocks produce correct structure
- HTML entities: `&` in attributes encoded as `&amp;`
- Empty children: blocks with no children render self-closing or empty tags
- Page rendering: full `<mjml><mj-head><mj-body>` structure
- Head metadata: fonts, styles, attributes, breakpoint all in `<mj-head>`

---

### 7. getAdapterAttributesString

**Signature**: `(params) → string`

**Test cases**:
- Converts attributes object to HTML attribute string
- XML entity encoding: `&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`, `"` → `&quot;`
- Empty string preservation for: alt, href, src, class, css-class, title
- Non-empty string attributes rendered as `key="value"`
- Testing mode: adds CSS classes
- Undefined/null attributes: omitted from output
- Boolean attributes: handled correctly
- Special characters in values: properly escaped

---

### 8. Utility Functions

#### `isValidBlockData(data)`
- **Returns**: boolean (type guard)
- **Test**: Valid block → true; missing type/attributes/children/data → false; unregistered type → false

#### `createBlockDataByType(type, payload?)`
- **Test**: Known type returns IBlockData; unknown type throws; payload merged with defaults

#### `mergeBlock(a, b)`
- **Test**: Deep merge preserving b's arrays; undefined b returns a; nested objects merged

#### `isCommentBlock(block)`
- **Test**: RAW block with only `<!-- comment -->` → true; RAW with other HTML → false; non-RAW → false

#### `getCommentText(block)`
- **Test**: Extracts text between `<!--` and `-->`, trims whitespace

#### `getPrecedingComment(parent, childIndex)`
- **Test**: Previous sibling is comment → returns text; no previous sibling → empty; previous is not comment → empty

#### `encodeXmlAttr(value)`
- **Test**: `&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`, `"` → `&quot;`; plain text unchanged

#### `encodeXmlContent(value)`
- **Test**: `&` → `&amp;`, `<` → `&lt;`; other chars unchanged

#### `isAdvancedBlock(type)`
- **Test**: AdvancedType values → true; BasicType values → false

#### `classnames(...args)`
- **Test**: Joins strings with spaces; filters non-strings; empty args → empty string

#### `parseReactBlockToBlockData(node)`
- **Test**: React element → static markup → JSON → IBlockData

---

### 9. ImageManager (Static Class)

| Method | Test Cases |
|--------|------------|
| `add(imgMap)` | Registers URLs, doesn't remove existing |
| `get(name)` | Returns URL or undefined |
| `getOverrideMap()` | Tracks which images were overridden |

### 10. TemplateEngineManager (Static Class)

| Method | Test Cases |
|--------|------------|
| `setTag(option)` | Registers custom tag template |
| `generateTagTemplate(name)` | Returns generator function; built-in: iteration, condition |

### 11. I18nManager

| Method | Test Cases |
|--------|------------|
| `setLocaleData(data)` | Sets translation dictionary |
| `translate(key, placeholder?)` | Returns translated string; with React node placeholder splits on `***` |

---

## Package: easy-email-editor

### 1. Components

#### `EmailEditorProvider`
- Props: `data: IEmailTemplate`, `children: (props, helper) => ReactNode`, `onSubmit?`, `validationSchema?`
- **Testable**: Initializes form with subject/subTitle/content; provides context to children; form mutation works

#### `EmailEditor`
- **Testable**: Renders correct tab (EDIT/MOBILE/PC); auto-switches to mobile when container < email width; user override prevents auto-switch; creates portal for fixed container

#### `EditEmailPreview`
- Shadow DOM rendering of editable email
- **Testable**: Initializes in shadow DOM; marks editor as initialized; handles drag-and-drop setup

#### `MobileEmailPreview`
- iPhone frame with scaled content
- **Testable**: Scales to 320px mobile width; shows preview HTML in iframe; displays error on render failure

#### `DesktopEmailPreview`
- Shadow DOM preview
- **Testable**: Renders HTML in shadow DOM; loads fonts; shows error on render failure

---

### 2. Hooks

#### `useBlock()`
Returns block manipulation functions:

| Function | Test Cases |
|----------|-----------|
| `addBlock({type, parentIdx, positionIndex?, payload?})` | Adds to correct parent; auto-wraps with intermediate blocks; validates parent-child; scrolls into view |
| `moveBlock(sourceIdx, destinationIdx)` | Moves block; handles auto-completion; updates focus |
| `copyBlock(idx)` | Duplicates in same parent; preserves all data |
| `removeBlock(idx)` | Removes from parent; cannot remove PAGE; updates focus |
| `setValueByIdx(idx, newVal)` | Updates block properties (debounced) |
| `setFocusBlock(val)` | Updates focused block data |
| `isExistBlock(idx)` | Returns true/false for valid/invalid idx |

#### `useFocusIdx()`
- **Test**: Returns `{ focusIdx, setFocusIdx }`; setFocusIdx updates context

#### `useHoverIdx()`
- **Test**: Returns debounced hover state; direction enum values

#### `useActiveTab()`
- **Test**: Returns `{ activeTab, setActiveTab }`; validates ActiveTabKeys enum

#### `useEditorProps()`
- **Test**: Returns typed context; mergeTagGenerate is always non-null

#### `useEditorContext()`
- **Test**: Returns formState, initialized flag, pageData from form values

#### `useRefState(state)`
- **Test**: ref.current stays in sync with state changes

#### `useLazyState(state, debounceTime)`
- **Test**: Returns debounced value; updates after delay

#### `useHotKeys()`
- **Test**: Ctrl+Z → undo; Ctrl+Y → redo; Tab → next sibling; Shift+Tab → prev sibling; no trigger when contenteditable focused

---

### 3. Providers (Context)

#### `BlocksProvider`
- State: `initialized`, `focusIdx`, `dragEnabled`, `collapsed`, `activeTab`
- **Testable**: Initial state; setter functions; ActiveTabKeys enum values

#### `HoverIdxProvider`
- State: `hoverIdx`, `isDragging`, `direction`, `dataTransfer`
- **Testable**: DataTransfer shape: `{ type, payload?, action: 'add'|'move', positionIndex?, parentIdx?, sourceIdx? }`

#### `RecordProvider`
- Undo/redo system with max 50 records
- **Testable**: undo() restores previous; redo() re-applies; max 50 cap; reset() clears; undoable/redoable flags

#### `PreviewEmailProvider`
- Converts JSON → MJML → HTML
- **Testable**: Generates valid HTML; handles render errors; applies onBeforePreview hook; merge tag injection

---

### 4. Utilities

#### `EventManager`
| Method | Test Cases |
|--------|-----------|
| `on(type, callback)` | Registers handler |
| `off(type, handler)` | Unregisters handler |
| `exec(type, ...args)` | Calls all handlers, returns boolean; tab change can be prevented |

EventTypes: `FOCUS_IDX_CHANGE`, `ADD_BLOCK`, `REMOVE_BLOCK`, `ACTIVE_TAB_CHANGE`

#### DOM Utilities
| Function | Test Cases |
|----------|-----------|
| `getBlockNodeByIdx(idx)` | Finds by className; returns null if not found |
| `getBlockNodeByChildEle(target)` | Walks up DOM to find .email-block ancestor |
| `getBlockNodes()` | Returns all .email-block elements from shadow DOM |
| `getEditorRoot()` | Returns #VisualEditorEditMode element |
| `getShadowRoot()` | Returns shadow root of editor root |
| `scrollBlockEleIntoView({idx})` | Scrolls element into view; only if out of viewport |

#### `getDirectionPosition(ev, deviation?)`
- Calculates mouse position relative to target bounds
- **Test**: Top/bottom/left/right edge detection; center position; edge threshold (deviation parameter)

#### `getInsertPosition(params)`
- Complex drag-and-drop position calculation
- **Test**: Valid parent-child placement; edge promotion to parent; column/section handling; null for invalid drops

#### Block Type Checkers
| Function | Test Cases |
|----------|-----------|
| `isTextBlock(type)` | BasicType.TEXT and AdvancedType.TEXT → true; others → false |
| `isTableBlock(type)` | AdvancedType.TABLE → true; others → false |
| `isButtonBlock(type)` | Both BasicType.BUTTON and AdvancedType.BUTTON → true |
| `isNavbarBlock(type)` | Both BasicType.NAVBAR and AdvancedType.NAVBAR → true |

#### `MergeTagBadge`
| Method | Test Cases |
|--------|-----------|
| `transform(content)` | `{{tagName}}` → `<input>` badge element |
| `revert(content, generateFn)` | Badge → merge tag string |
| Recursive processing of nested content |

#### `HtmlStringToReactNodes(content, options)`
- **Test**: Converts HTML → React; sets contentEditable on block elements; handles merge tag badges; parses inline styles to React format; filters comments

---

## Package: easy-email-extensions

### 1. MjmlToJson (src/utils/MjmlToJson.ts)

**Signature**: `MjmlToJson(data: MjmlBlockItem | string, skipDefaults?: boolean) → IPage`

**Test cases**:
- String input: parses MJML string via mjml-browser
- AST input: direct transformation
- `skipDefaults=false` (default): merges editor defaults via `block.create(payload)`
- `skipDefaults=true`: preserves source attributes only
- **Head extraction**: fonts, styles, breakpoint, title, preview, headAttributes
- **Metadata extraction**: font-family, text-color, content-background-color, responsive from mj-html-attributes
- **RAW_ILLEGAL_ATTRS**: Strips padding, border, direction, text-align, etc. from mj-raw blocks
- **Padding normalization**: Shorthand `padding: "10px 20px"` → individual properties
- **Comment stripping**: Removes HTML comments from AST
- **Carousel**: Extracts images array from children
- **Navbar**: Extracts links from children
- **Social**: Extracts elements from children
- **Nested metadata**: Handles `multiple-attributes=true` flag

#### `getMetaDataFromMjml(data?)`
- Parses `<mj-html-attributes>` with `class="easy-email"`
- **Test**: Extracts all metadata keys; handles missing data; handles empty attributes

---

### 2. parseXMLtoBlock (src/utils/parseXMLtoBlock.ts)

#### `parseXMLtoBlock(text)`
- **Test branches**:
  1. Valid full MJML document → mjml-browser parse → MjmlToJson (with defaults)
  2. Invalid XML but valid HTML element → DOMParser fallback → transformElement
  3. Neither valid → throws "Invalid content"
- **Test**: Full document, partial element, invalid input, element with RAW_ILLEGAL_ATTRS

#### `parseXMLtoBlockFidelity(text)`
- Same as above but with `skipDefaults=true`
- **Critical test**: Source attributes preserved; no default padding/border/direction injected
- **Test**: Import → export round-trip produces equivalent MJML without extra attributes

---

### 3. SimpleLayout Component

**Props**: `{ defaultShowLayer?, showBlockLayer?, blockMjmlPanel?, children }`

**Testable behaviors**:
- **Sidebar persistence**: Saves/loads sidebarWidth, layoutColumnWidth, showLayoutColumn to localStorage
- **Debounced save**: 300ms debounce on sidebar preference changes
- **Responsive**: Auto-hides 2nd column when viewport < 1300px
- **Resize handles**: Drag to resize with constraints (SIDEBAR_MIN=300, SIDEBAR_MAX=900, LAYOUT_COL_MIN=120)
- **Start collapsed**: Sidebar hidden initially
- **Double-click to open**: Content area double-click opens sidebar
- **Auto-collapse toggle**: When enabled, unfocused sections collapse in BlockLayer

---

### 4. BlockLayer Component

**Props**: `{ renderTitle?, autoCollapse? }`

**Testable behaviors**:
- **Tree building**: Converts IBlockData tree to IBlockDataWithId tree with unique IDs
- **Comment label extraction**: Comment-only mj-raw blocks filtered out, text attached as `commentLabel` to next sibling
- **Auto-collapse**: When focus changes, only ancestors of focused block are expanded
- **Expand/collapse all**: handleExpandAll opens entire tree; handleCollapseAll collapses to root
- **Selection**: onSelect sets focusIdx and scrolls into view
- **Context menu**: Move up/down, Copy, Delete, Add to Collection
- **Drag-and-drop**: validates drop targets, moves blocks, handles comment-attached blocks
- **Scroll retry**: Up to 5 attempts with delay for elements not yet rendered

---

### 5. AttributePanel

**Testable behaviors**:
- Looks up correct panel component from `BlockAttributeConfigurationManager` for each block type
- Renders within PresetColorsProvider + SelectionRangeProvider
- Re-creates component when focusIdx changes (key prop)
- Every block type has a registered panel (basic + advanced)

#### BlockAttributeConfigurationManager
| Method | Test Cases |
|--------|-----------|
| `add(componentMap)` | Registers panel components |
| `get(name)` | Returns component or null for unregistered type |
| `getMap()` | Returns full registry |

---

### 6. InteractivePrompt Components

#### HoverTooltip
- Shows block name label and drag indicators on hover
- **Test**: Correct label for each block type; comment subtitle display; direction indicators during drag; skips rendering when hover === focus

#### FocusTooltip
- Shows delete button and spacer resize handle
- **Test**: Delete button hidden for PAGE type; spacer resize updates height attribute; outline rendered; drag delta clamped to >= 0

---

### 7. Utility Functions

#### `getBlockTitle(blockData, isFromContent?)`
- **Test**: Returns blockData.title if set; extracts text from HTML content for TEXT/BUTTON; falls back to block name

#### `getIconNameByBlockType(type)`
- **Test**: Returns correct icon for each BasicType and AdvancedType; unknown type returns 'icon-number'

#### `getContextMergeTags(mergeTags, context, idx)`
- **Test**: Resolves merge tags from parent dataSources; handles nested replacements; walks up hierarchy

#### `extractColorsFromTemplate(rootBlock)`
- **Test**: Extracts from attributes (color, background-color, etc.); extracts from border shorthand; extracts from HTML content; normalizes 3-char hex; sorts by hue (grays first)

#### `awaitForElement(idx)`
- **Test**: Resolves immediately if element exists; polls every 50ms; cancel stops polling

---

### 8. Form Components

All form components for attribute editing:
- `Input`, `Select`, `CheckBoxGroup`, `RadioGroup`, `AutoComplete`, `InputWithUnit`
- `RichTextField`, `RichTextToolBar` (with Basic and Advanced tools)
- `ColorPicker`, `ColorPicker2`, `ColorPickerField`
- `ImageUploader`, `EditTab`, `EditGridTab`, `InlineTextField`, `UploadField`, `AddFont`
- Adapters: `Json.adapter`, `color.adapter`, `pixel.adapter`, `image-height.adapter`, `slider.adapter`

**Each adapter testable**: Input format → normalized output; edge cases; round-trip consistency

---

## Demo Application

### 1. Pages

#### Home Page (`pages/Home/index.tsx`)

**Features to test**:
- Template list loading and display (sorted by updated_at desc)
- Search filtering on both saved and user templates
- MJML import: `parseXMLtoBlockFidelity(mjmlString)` → save as new template
- Import error handling (invalid MJML shows error message)
- Thumbnail generation with localStorage cache
- 5-second polling for presence data and template list
- Empty state rendering when no templates
- User template vs built-in template distinction

#### CardItem Component
- Thumbnail display with fallback to colored initial box
- Active editor badges (presence indicators)
- Delete confirmation with 3-second auto-cancel
- Duplicate template functionality
- Hover effects and template badge

#### Editor Page (`pages/Editor/index.tsx`)

**Visual Editor Features**:
- Block-based email editing via easy-email-editor
- Autosave with debounced saves (~500ms)
- Manual save button with "saved X seconds ago" indicator
- Template mode vs email mode distinction
- New vs existing template load paths

**Code Mode Features**:
- Full MJML code editor with syntax highlighting
- Split editor/preview with draggable divider (25-75% range)
- Live preview compilation (500ms debounce)
- Desktop/mobile preview toggle
- Custom MJML auto-formatting (formatMjml)
- Line wrap and fullscreen toggles

**Block Code Editor Features**:
- Per-block MJML editing in sidebar
- Breadcrumb navigation (clickable to jump to parent)
- `buildFullPageMjml()`: Generates full document context for correct parsing
- `applyMjml()`: Parses edited MJML back to block tree
- Inline validation with error list
- Confirmation dialog when leaving with invalid MJML
- Auto-closing tags, syntax highlighting, fold gutter

**Preview Mode Features**:
- Full HTML preview with desktop/mobile width toggle
- Export options (Download HTML, Download MJML, Copy HTML, Copy MJML)
- "Back to editor" button

**MJML Validation Features**:
- Real-time validation with `mjml-browser` soft mode
- Error filtering: skips mj-head, mj-html-attributes, mj-meta, mj-raw attribute errors
- Jump-to-line from validation errors
- Re-run validation button
- AI fix integration (streaming Claude API)

**Toolbar Features**:
- 3 groups: Save+Status | Actions | Mode toggle
- Mode toggle: Code | Edit | Preview
- Undo/redo buttons with disabled states
- History panel toggle
- Export dropdown
- Validation badge with error count

**Revision History Features**:
- Version snapshots on every save
- Revision list sorted newest first
- Restore from revision
- Add/edit revision notes
- Clear all revisions

**Collaboration Features**:
- WebSocket-based real-time editing
- Remote cursor visualization
- Block locks (advisory)
- Code mode proposal/confirmation workflow
- AI lock/unlock coordination

**Component Library Features**:
- Per-template component extraction (WRAPPER and SECTION blocks)
- Comment-based naming (preceding `<!-- Name -->` comment)
- Grid and list view toggle (persisted preference)
- Search filtering
- Thumbnail generation and display
- Insert at cursor position (above/below)
- Rename components
- Hover preview in list view
- Sync to server via bulk PUT

**Export Processing**:
- `getCleanMjml()`: Strips editor metadata (`mj-html-attributes`), unwraps comment raw blocks
- Find/replace rules applied per format (HTML/MJML/both)
- Download as file or copy to clipboard

#### Settings Page (`pages/Settings/index.tsx`)

**Features to test**:
- API key management: save, remove, masked display
- Multi-user editing toggle
- Hide editor metadata toggle
- Spacer indicator toggle with color picker
- Export find & replace rules: add, remove, regex toggle, format selector
- Color format conversion: RGB string ↔ hex

---

### 2. Hooks

#### `useAppSettings()`
**Returns**: `[AppSettings, (patch: Partial<AppSettings>) => void]`

**Default settings**:
```typescript
{
  multiUserEnabled: false,
  hideEditorMetadata: false,
  showSpacerIndicator: true,
  spacerIndicatorColor: "147, 197, 253",
  autoSaveEnabled: true,
  exportFindReplace: [],
  disabledBlockTypes: []
}
```

**Testable**:
- Loads from localStorage on init
- Saves to localStorage on update
- Cross-instance sync via static listener set
- `getAppSettings()` static getter works without React context
- `applyExportFindReplace(content, format)`: applies matching rules, handles regex, skips invalid regex

#### `useCodeMirrorControls(editorRef, defaultLineWrap)`
- **Test**: toggleLineWrap updates editor option; toggleFullscreen refreshes CodeMirror; Escape exits fullscreen

#### `useCollaboration(roomId, callbacks)`
- **Test**: WebSocket connection lifecycle; message sending/receiving for all types; auto-reconnect on close; room cleanup on leave; code mode proposal flow; identity updates

#### `useLoading(keys)`
- **Test**: Single key loading state; multiple keys combined; per-item loading with actionKey

#### `useQuery()`
- **Test**: Parses URL query params; patchQuery merges and navigates

---

### 3. Utilities

#### `api.ts` — API Client
| Function | Test Cases |
|----------|-----------|
| `getAll()` | Fetches template list |
| `getUserTemplates()` | Fetches user templates |
| `getById(id)` | Fetches single template; 404 handling |
| `save(article)` | PUT with fallback to POST |
| `remove(id)` | DELETE template |
| `generateId()` | Returns timestamp-based unique ID |
| `getRevisions(articleId)` | Fetches revision list |
| `addRevision(articleId, rev)` | Creates revision |
| `updateRevisionNote(revisionId, note)` | Updates note |
| `clearRevisions(articleId)` | Deletes all revisions |
| `getApiKeyStatus()` | Returns {configured, masked} |
| `setApiKey(key)` | Saves API key |
| `removeApiKey()` | Deletes API key |
| `fixMjmlWithAI(mjml, errors, onThinking?, onText?)` | SSE streaming; parses thinking/text/done/error events |
| `getComponents(templateId)` | Fetches component list |
| `syncComponents(templateId, components)` | Bulk sync components |

#### `generateThumbnail.ts`
- Converts IBlockData → MJML → HTML → canvas → JPEG data URL
- **Test**: Returns data URL string; handles empty blocks; 600px width, 0.5 scale, 60% JPEG quality

#### `clipboard.ts`
- `copy(text)`: Creates hidden textarea, executes copy command
- **Test**: Copies text to clipboard; cleanup removes textarea

#### `download.ts`
- `downloadFile(content, filename, mimeType)`: Creates blob and triggers download
- **Test**: Creates correct blob; proper MIME type; cleanup revokes URL

#### `time.ts`
| Function | Test Cases |
|----------|-----------|
| `nowUnix()` | Returns current time in seconds |
| `timeAgo(unix)` | <10s → "Just now"; <1m → "Xs ago"; <1h → "Xm ago"; <24h → "Xh ago"; <7d → "Xd ago"; else → formatted date |

#### `revisions.ts` — Local Revision Store
| Method | Test Cases |
|--------|-----------|
| `getAll(articleId)` | Sorted desc by ID; max 50 |
| `add(articleId, rev)` | Sequential IDs; backfill from timestamps; localStorage quota fallback |
| `updateNote(articleId, revisionId, note)` | Updates specific revision |
| `clear(articleId)` | Removes all for article |

#### `user-identity.ts`
| Function | Test Cases |
|----------|-----------|
| `getUserIdentity()` | Loads from localStorage or generates random |
| `updateUserIdentity(animal, colorHex)` | Persists to localStorage |
| Constants: ANIMALS (16 animals), COLORS (12 colors) |

#### `getIsFormTouched(touchedObj)`
- **Test**: No touched fields → false; nested touched field → true; mixed → true

#### `ConfirmBeforeLeavePage`
- **Test**: Stores callback; callback invoked on navigation

#### `formatMjml(mjmlString)` (in MjmlCodeEditor)
Custom MJML-aware formatter:
- **Tag tokenization**: Regex-based extraction of opening, closing, self-closing tags
- **Indent rules**: Opening mj-* → increment; closing → decrement; self-closing → no change
- **Content preservation**: mj-text, mj-button, mj-style, mj-raw, mj-title, mj-preview, mj-accordion-title, mj-accordion-text content preserved verbatim
- **Self-closing detection**: Tags ending with `/>` treated as self-closing (not content tags)
- **Tab indentation**: Uses tabs, not spaces
- **Blank line rules**: After `<mjml>`, `<mj-head>`, `<mj-body>`; before/after `<mj-attributes>`, `<mj-style>`; between sibling sections/wrappers; before `</mj-body>`; no double blanks
- **Test cases**: Full template formatting; self-closing tags; content blocks; nested structures; blank line placement; edge cases (empty tags, attributes with special chars)

---

## Server

### 1. REST API Endpoints

#### Templates CRUD
| Endpoint | Method | Test Cases |
|----------|--------|-----------|
| `/api/templates` | GET | Returns all non-template drafts sorted by updated_at desc |
| `/api/user-templates` | GET | Returns only `is_template=1` entries |
| `/api/templates/:id` | GET | Returns template; 404 for missing |
| `/api/templates` | POST | Creates template; defaults for missing fields; 201 status |
| `/api/templates/:id` | PUT | Partial update; content format handling (object/string); 404 for missing |
| `/api/templates/:id` | DELETE | Cascades to revisions+components; returns `{ok: true}` |

#### Revisions
| Endpoint | Method | Test Cases |
|----------|--------|-----------|
| `/api/templates/:id/revisions` | GET | Returns max 50 sorted by id desc |
| `/api/templates/:id/revisions` | POST | Creates revision; auto-timestamp; 201 status |
| `/api/templates/:id/revisions` | DELETE | Deletes all for template |
| `/api/revisions/:id/note` | PUT | Updates note field |

#### Components
| Endpoint | Method | Test Cases |
|----------|--------|-----------|
| `/api/templates/:id/components` | GET | Returns sorted by position asc |
| `/api/templates/:id/components` | PUT | Transactional replace; auto-position from array index; accepts array or `{components}` object |

#### Settings
| Endpoint | Method | Test Cases |
|----------|--------|-----------|
| `/api/settings/anthropic-key` | GET | Returns {configured, masked}; masked format: first 7 + last 4 chars |
| `/api/settings/anthropic-key` | PUT | Stores key; 400 for empty key |
| `/api/settings/anthropic-key` | DELETE | Removes key |

#### Presence
| Endpoint | Method | Test Cases |
|----------|--------|-----------|
| `/api/presence` | GET | Returns rooms with active users |

#### AI
| Endpoint | Method | Test Cases |
|----------|--------|-----------|
| `/api/ai/fix-mjml` | POST | SSE streaming; thinking/text/done/error events; 400 for missing key; 502 for API error |

### 2. WebSocket Messages

| Message Type | Direction | Test Cases |
|-------------|-----------|-----------|
| `join` | Client→Server | Creates room; broadcasts user-joined; sends existing locks/cursors |
| `leave` | Client→Server | Clears locks; broadcasts user-left; cleans empty rooms |
| `cursor` | Client→Server | Broadcasts cursor-moved to room |
| `lock` | Client→Server | Records lock; broadcasts block-locked |
| `unlock` | Client→Server | Removes lock; broadcasts block-unlocked |
| `mouse-position` | Client→Server | Broadcasts mouse-moved |
| `text-cursor` | Client→Server | Broadcasts text-cursor-moved |
| `content-change` | Client→Server | Broadcasts content-updated |
| `identity-update` | Client→Server | Updates user info; broadcasts updated user list |
| `code-mode-request` | Client→Server | Solo → auto-approve; multi → propose to all |
| `code-mode-confirm` | Client→Server | Increments confirmations; unanimous → enters code mode |
| `code-mode-reject` | Client→Server | Broadcasts rejection and cancellation |
| `code-mode-exit` | Client→Server | Broadcasts exited with content |
| `ai-lock` | Client→Server | Broadcasts ai-locked |
| `ai-unlock` | Client→Server | Broadcasts ai-unlocked |

### 3. Database

**Tables**: `templates`, `revisions`, `components`, `settings`

**Test cases**:
- Schema creation on first run
- Foreign key cascading (delete template → delete revisions + components)
- WAL mode enabled
- is_template migration (column added if missing)
- Prepared statement parameterization (SQL injection prevention)

---

## Cross-Cutting Concerns

### 1. MJML Round-Trip Fidelity

The most critical testable flow:

```
MJML String
  → parseXMLtoBlockFidelity(text)   [Import path - preserves source]
  → IBlockData tree
  → JsonToMjml({data, mode:'production'})
  → MJML String (should match original semantically)
```

**Key assertions**:
- `<mj-attributes>` declarations preserved (not empty)
- `<mj-class>` definitions intact
- `<mj-title>` and `<mj-preview>` present
- `lang="en"` on root `<mjml>` element
- HTML entities not double-encoded (`&` should not become `&amp;amp;`)
- `<mj-raw>` content preserved (meta tags, MSO conditionals)
- No spurious default attributes injected (padding, border, direction)
- Visual→Code→Visual produces identical block data

### 2. Two Parser Paths

| Parser | Use Case | Merges Defaults? | Test Focus |
|--------|----------|-----------------|------------|
| `parseXMLtoBlock(text)` | Code→Visual in editor | Yes | Correct defaults applied |
| `parseXMLtoBlockFidelity(text)` | Import MJML on home page | No | Source attributes preserved |

### 3. Content Block Preservation

For mj-text, mj-style, mj-raw, mj-button:
- Inner HTML content must survive round-trip
- HTML entities in URLs (`&` → `&amp;`) are expected
- CSS in `<mj-style>` must not be reformatted
- `<mj-raw>` MSO conditionals must be preserved exactly

### 4. Block Operations with Comments

Comment-only `<mj-raw>` blocks (containing only `<!-- text -->`) serve as section labels:
- BlockLayer hides them and shows text as `commentLabel` on next sibling
- Move operations must move comment + block together
- Copy operations must copy comment + block together
- Delete operations must delete comment + block together

### 5. Export Pipeline

```
IBlockData tree
  → JsonToMjml({beautify: true})
  → stripEditorMetadata() [removes mj-html-attributes]
  → unwrapCommentRawBlocks() [strips mj-raw wrapper from comments]
  → applyExportFindReplace(content, format) [user-defined replacements]
  → Final MJML/HTML output
```

### 6. Collaboration Flows

**Code mode consensus**:
1. User A requests code mode
2. If alone → auto-approve
3. If others → broadcast proposal
4. All must confirm → enters code mode (clears all locks)
5. Any rejection → cancels proposal
6. Exit → broadcasts updated content

**Block locking**:
1. User clicks to edit block
2. Lock sent to server
3. Server broadcasts to room
4. Other users see lock indicator
5. Lock cleared on focus change or disconnect

### 7. Auto Mobile View Switching

- ResizeObserver monitors container width
- If container width < email width → switch to mobile tab
- If container width >= email width and was narrow → switch to desktop
- `wasNarrowRef` prevents continuous re-triggering (transition-based)
- `userOverrideRef` respects manual tab picks, resets on narrow→wide transition

---

## Test Fixture Reference

**File**: `test-fixtures/test-template.mjml`

Covers:
- `<mj-title>`, `<mj-preview>`, `<mj-breakpoint>`
- `<mj-attributes>` with global defaults, `<mj-class>`, HTML comments
- `<mj-style>` with CSS including media queries
- `<mj-raw>` with meta tags and MSO conditionals
- `<mjml lang="en">` root attribute
- Body elements: sections, columns, wrappers, groups, text, images, buttons, spacers, dividers
- HTML entities: `&rsquo;`, `&rarr;`, `&bull;`, `&amp;`, `&copy;`
- URLs with `&` query parameters
- `mj-class` and `css-class` references
- Two-column layouts, background images and colors, nested wrappers
