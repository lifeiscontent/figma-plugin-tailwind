
# Figma → Tailwind CSS v4 Theme Plugin

Export your Figma design tokens and variables to Tailwind CSS v4's `@theme` format, with support for dark mode, custom variants, and stateful utility overrides.

## Quickstart

1. **Install the plugin in Figma** (or run locally in development mode).
2. **Name your variables** in Figma using slashes for namespaces:
   - `color/primary-500`
   - `background-color/button-primary`
   - `radius/md`
   - `z/modal`
3. **Use Figma modes** for light/dark/contrast, etc.
4. **For stateful/component overrides, use the @utility/@variant convention:**
   - Example: `@utility/bg-button-primary/@variant/active/background-color/button-primary`
   - The last segment is always the canonical variable name you want to override.
   - This emits an `@utility` block with `@variant` children for each state.
5. **Optional:** Add an `@custom-variant` collection to define extra custom selectors (only needed if you want variants beyond Tailwind’s defaults).
6. **Export and copy the generated CSS** into your Tailwind v4 project.

## Figma Variable Naming

- Use slashes for namespaces: `color/primary-500`, `spacing/lg`, `radius/md`
- Use Figma modes for light/dark/contrast (e.g., `light`, `dark`, `dark,contrast-more`)
- For stateful overrides, use the @utility/@variant pattern:

  ```text
  background-color/button-primary
  @utility/bg-button-primary/@variant/active/background-color/button-primary
  @utility/bg-button-primary/@variant/aria-pressed/background-color/button-primary
  ```

  This generates:

  ```css
  @theme {
    --background-color-button-primary: ...;
  }

  @utility bg-button-primary {
    @variant active {
      --background-color-button-primary: ...;
    }
    @variant aria-pressed {
      --background-color-button-primary: ...;
    }
  }
  ```

- Use this pattern for any stateful or component-specific overrides.
- Do **not** use `/@variant/` in variable names—always use the @utility convention for stateful overrides.

## Custom Variants

Add a Figma collection named `@custom-variant` to define custom selectors (e.g., dark mode):

| Figma Variable | Selector |
|----------------|----------|
| `dark`         | `(&:where(.dark, .dark *))` |

## Variable Namespace Prefixes

Use Tailwind v4 namespace prefixes for your variables:

You can either encode the namespace in the variable name (e.g. `text-color/heading`), or (recommended for designers) let the plugin infer it from Figma variable scopes.

The plugin also strips common designer-friendly prefix folders like `stroke/`, `effects/`, or `Fill Text/` when generating the final Tailwind variable name.

**Fractional spacing in Figma**

Tailwind spacing utilities support fractional steps like `p-0.5`, but a literal `.` is not usable directly in Figma token names.
Use an underscore to represent the decimal point in spacing names.

Also, don’t create separate negative spacing tokens like `spacing/-1` — Tailwind already generates negative spacing utilities automatically.

- Figma: `spacing/0_5`
- Output: `--spacing-0\.5`
- Utility: `p-0.5`

**Scope-based color inference**

- `ALL_FILLS`/`ALL_SCOPES` → `--color-*`
- `FRAME_FILL` → `--background-color-*`
- `SHAPE_FILL` → `--fill-*`
- `TEXT_FILL` → `--text-color-*`
- `STROKE_COLOR` → `--border-color-*`, `--outline-color-*`, `--ring-color-*`, `--divide-color-*`
- `EFFECT_COLOR` → `--shadow-color-*`
- Colors with no scopes are skipped.
- Colors with `hiddenFromPublishing` enabled are skipped.
- If WEB code syntax is set, the CSS variable name is used as-is and only one variable is emitted.

| Prefix            | Example Variable                | Output CSS Variable           | Tailwind Utilities         |
|-------------------|---------------------------------|------------------------------|---------------------------|
| `color`           | `color/primary-500`             | `--color-primary-500`        | `text-*`, `bg-*`, etc.    |
| `background-color`| `background-color/button-primary`| `--background-color-button-primary` | `bg-*` only         |
| `text-color`      | `text-color/heading`            | `--text-color-heading`        | `text-*` only             |
| `border-color`    | `border-color/divider`          | `--border-color-divider`      | `border-*` only           |
| ...               | ...                             | ...                          | ...                       |

Variables without a namespace prefix are output as `--var-*` (generic).

## Opacity Variants

**Don't create separate opacity variables.** Tailwind handles this automatically:

```html
<div class="bg-primary/50">...</div>
<div class="text-white/60">...</div>
```

If you need opacity variants in Figma for design, name them with the opacity at the end (e.g., `color/white/4`). The plugin will skip these.

## Common Mistakes

- **Redundant prefixes:**
  - Avoid: `color/text/primary` (becomes `text-text-primary`)
  - Use:   `color/primary` (becomes `text-primary`)
- **Missing namespace:**
  - Avoid: `white` (becomes `--var-white`)
  - Use:   `color/white` (becomes `--color-white`)

## Example Figma Structure

```
Design Tokens (Collection)
├── color
│   ├── white          → --color-white           → text-white, bg-white
│   ├── white/4        → ⏭️ skipped              → use text-white/4
│   ├── black          → --color-black           → text-black, bg-black
│   ├── blue
│   │   ├── 50         → --color-blue-50         → text-blue-50, bg-blue-50
│   │   ├── 500        → --color-blue-500        → text-blue-500, bg-blue-500
│   │   └── 900        → --color-blue-900        → text-blue-900, bg-blue-900
│   ├── primary        → --color-primary         → text-primary, bg-primary
│   ├── primary/50     → ⏭️ skipped              → use bg-primary/50
│   └── muted          → --color-muted           → text-muted, bg-muted
├── spacing
│   ├── xs             → --spacing-xs            → p-xs, m-xs, gap-xs
│   ├── sm             → --spacing-sm            → p-sm, m-sm, gap-sm
│   ├── md             → --spacing-md            → p-md, m-md, gap-md
│   └── lg             → --spacing-lg            → p-lg, m-lg, gap-lg
├── radius
│   ├── sm             → --radius-sm             → rounded-sm
│   ├── md             → --radius-md             → rounded-md
│   └── full           → --radius-full           → rounded-full
├── shadow
│   ├── sm             → --shadow-sm             → shadow-sm
│   └── lg             → --shadow-lg             → shadow-lg
├── font
│   ├── sans           → --font-sans             → font-sans
│   └── mono           → --font-mono             → font-mono
├── text
│   ├── sm             → --text-sm               → text-sm
│   ├── base           → --text-base             → text-base
│   └── lg             → --text-lg               → text-lg
├── leading
│   ├── tight          → --leading-tight         → leading-tight
│   └── relaxed        → --leading-relaxed       → leading-relaxed
├── z
│   ├── 10             → --z-10                  → z-10
│   └── modal          → --z-modal               → z-modal
└── duration
    ├── fast           → --duration-fast         → duration-fast
    └── slow           → --duration-slow         → duration-slow
```

## Development Setup

Below are the steps to get your plugin running. You can also find instructions at:

  https://www.figma.com/plugin-docs/plugin-quickstart-guide/

This plugin template uses Typescript and NPM, two standard tools in creating JavaScript applications.

First, download Node.js which comes with NPM. This will allow you to install TypeScript and other
libraries. You can find the download link here:

  https://nodejs.org/en/download/

Next, install TypeScript using the command:

  npm install -g typescript

Finally, in the directory of your plugin, get the latest type definitions for the plugin API by running:

  npm install --save-dev @figma/plugin-typings

If you are familiar with JavaScript, TypeScript will look very familiar. In fact, valid JavaScript code
is already valid Typescript code.

TypeScript adds type annotations to variables. This allows code editors such as Visual Studio Code
to provide information about the Figma API while you are writing code, as well as help catch bugs
you previously didn't notice.

For more information, visit https://www.typescriptlang.org/

Using TypeScript requires a compiler to convert TypeScript (code.ts) into JavaScript (code.js)
for the browser to run.

We recommend writing TypeScript code using Visual Studio code:

1. Download Visual Studio Code if you haven't already: https://code.visualstudio.com/.
2. Open this directory in Visual Studio Code.
3. Compile TypeScript to JavaScript: Run the "Terminal > Run Build Task..." menu item,
    then select "npm: watch". You will have to do this again every time
    you reopen Visual Studio Code.

That's it! Visual Studio Code will regenerate the JavaScript file every time you save.
