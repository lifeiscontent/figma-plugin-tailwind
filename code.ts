// Splits a comma-separated variant string and sanitizes each variant
function getSanitizedVariants(variant: string): string[] {
  return variant
    .split(",")
    .map((v) => sanitizeName(v.trim()))
    .filter(Boolean);
}
// Returns canonical CSS variable name from segments
function getCanonicalVarName(segments: string[]): string {
  return normalizeTailwindCssVarName(`--${sanitizeName(segments.join("-"))}`);
}
// Returns { isUtility, utilityName, variant, canonicalVarSegments } if @utility, else null
function parseUtilityVariableName(name: string): null | {
  isUtility: boolean;
  utilityName: string;
  variant: string;
  canonicalVarSegments: string[];
} {
  const segments = name.split("/");
  if (segments[0] !== "@utility") return null;
  const utilityName = segments[1];
  const variantIdx = segments.indexOf("@variant");
  if (variantIdx > 1 && variantIdx < segments.length - 1) {
    const variant = segments[variantIdx + 1];
    const canonicalVarSegments = segments.slice(variantIdx + 2);
    return {
      isUtility: true,
      utilityName,
      variant,
      canonicalVarSegments,
    };
  }
  return null;
}
function rgbToOklch({ r, g, b, a = 1 }: RGBA): string {
  // Convert sRGB to linear RGB
  const toLinear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);

  // Linear RGB to XYZ
  const x = 0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb;
  const y = 0.2126729 * lr + 0.7151522 * lg + 0.072175 * lb;
  const z = 0.0193339 * lr + 0.119192 * lg + 0.9503041 * lb;

  // XYZ to Oklab
  const l_ = Math.cbrt(0.8189330101 * x + 0.3618667424 * y - 0.1288597137 * z);
  const m_ = Math.cbrt(0.0329845436 * x + 0.9293118715 * y + 0.0361456387 * z);
  const s_ = Math.cbrt(0.0482003018 * x + 0.2643662691 * y + 0.633851707 * z);

  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const aa = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

  // Oklab to Oklch
  const C = Math.sqrt(aa * aa + bb * bb);
  let H = (Math.atan2(bb, aa) * 180) / Math.PI;
  if (H < 0) H += 360;

  const lightness = (L * 100).toFixed(1);
  const chroma = C.toFixed(3);
  const hue = C < 0.0001 ? "none" : H.toFixed(1);

  if (a !== 1) {
    return `oklch(${lightness}% ${chroma} ${hue} / ${a.toFixed(2)})`;
  }
  return `oklch(${lightness}% ${chroma} ${hue})`;
}

function sanitizeName(name: string): string {
  return name
    .replace(/\//g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-_]/g, "")
    .toLowerCase();
}

function normalizeTailwindCssVarName(cssVarName: string): string {
  // Tailwind uses fractional spacing utilities like `p-0.5`.
  // In CSS variables, a literal `.` must be escaped, so we let designers use `_` in Figma.
  // Example: `spacing/0_5` -> `--spacing-0\.5`
  if (cssVarName.startsWith("--spacing-")) {
    return cssVarName.replace(/(\d)_(\d)/g, "$1\\.$2");
  }

  return cssVarName;
}

const TAILWIND_COLOR_NAMESPACES = [
  "color",
  "background-color",
  "text-color",
  "border-color",
  "outline-color",
  "ring-color",
  "divide-color",
  "fill",
  "shadow-color",
  "custom",
] as const;

type TailwindColorNamespace = (typeof TAILWIND_COLOR_NAMESPACES)[number];

type ColorEmission = {
  namespace: TailwindColorNamespace;
  cssVarName: string;
};

type VariableMeta = {
  hiddenFromPublishing: boolean;
  scopes: ReadonlyArray<VariableScope>;
  codeSyntaxWeb?: string;
  colorEmissions: Map<TailwindColorNamespace, string>;
};

function splitNameAndLeafVariants(name: string): {
  baseName: string;
  leafVariants: string[];
} {
  const segments = name.split("/");
  const variantIdx = segments.indexOf("@variant");
  if (variantIdx > 0 && variantIdx < segments.length - 1) {
    const baseName = segments.slice(0, variantIdx).join("/");
    const leafVariants = segments[variantIdx + 1]
      .split(",")
      .map((v) => sanitizeName(v.trim()))
      .filter(Boolean);
    return { baseName, leafVariants };
  }
  return { baseName: name, leafVariants: [] };
}

const DESIGNER_FRIENDLY_COLOR_PREFIXES = new Set([
  // General
  "colors",
  "colour",
  "colours",

  // Background-ish
  "bg",
  "background",
  "backgrounds",

  // Text-ish
  "text",
  "type",
  "typography",
  "fill-text",
  "text-fill",

  // Stroke / border-ish
  "stroke",
  "strokes",
  "border",
  "borders",
  "outline",
  "ring",
  "divide",

  // SVG fill-ish
  "fill",
  "fills",
  "shape-fill",
  "shape",

  // Effects
  "effect",
  "effects",
  "shadow",
  "shadows",
]);

function stripLeadingTailwindNamespaceFromName(name: string): string {
  const segments = name.split("/");
  if (segments.length === 0) return name;
  const first = segments[0] as TailwindColorNamespace;
  if (TAILWIND_COLOR_NAMESPACES.includes(first)) {
    return segments.slice(1).join("/");
  }
  return name;
}

function stripLeadingDesignerFriendlyPrefix(name: string): string {
  const segments = name.split("/");

  // Only strip if there's still something meaningful left
  while (segments.length > 1) {
    const normalized = sanitizeName(segments[0]);
    if (!DESIGNER_FRIENDLY_COLOR_PREFIXES.has(normalized)) break;
    segments.shift();
  }

  return segments.join("/");
}

function getTailwindColorNamespacesFromScopes(
  scopes: ReadonlyArray<VariableScope>
): TailwindColorNamespace[] {
  const scopeSet = new Set(scopes);

  if (scopeSet.size === 0) return [];

  if (scopeSet.has("ALL_SCOPES")) return ["color"];
  if (scopeSet.has("ALL_FILLS")) return ["color"];

  const namespaces: TailwindColorNamespace[] = [];

  if (scopeSet.has("FRAME_FILL")) {
    namespaces.push("background-color");
  }
  if (scopeSet.has("SHAPE_FILL")) {
    namespaces.push("fill");
  }
  if (scopeSet.has("TEXT_FILL")) {
    namespaces.push("text-color");
  }
  if (scopeSet.has("STROKE_COLOR")) {
    namespaces.push("border-color");
    namespaces.push("outline-color");
    namespaces.push("ring-color");
    namespaces.push("divide-color");
  }
  if (scopeSet.has("EFFECT_COLOR")) {
    namespaces.push("shadow-color");
  }

  return namespaces;
}

function extractCssVarNameFromCodeSyntax(webSyntax: string): string | null {
  const match = webSyntax.match(/--[a-zA-Z0-9-_]+/);
  return match ? match[0] : null;
}

function getCssVarNameFromCodeSyntax(webSyntax: string): string {
  const extracted = extractCssVarNameFromCodeSyntax(webSyntax);
  if (extracted) return extracted;

  const trimmed = webSyntax.trim();
  if (trimmed.startsWith("--")) return trimmed;
  return `--${trimmed}`;
}

function getColorSuffixName(variable: Variable, baseName: string): string {
  const withoutTailwindNamespace = stripLeadingTailwindNamespaceFromName(baseName);
  const withoutDesignerPrefix = stripLeadingDesignerFriendlyPrefix(
    withoutTailwindNamespace
  );
  return sanitizeName(withoutDesignerPrefix);
}

function getColorEmissions(variable: Variable): ColorEmission[] {
  if (variable.resolvedType !== "COLOR") return [];
  if (variable.hiddenFromPublishing) return [];
  if (isOpacityVariant(variable.name)) return [];

  const scopes = variable.scopes ?? [];
  const namespaces = getTailwindColorNamespacesFromScopes(scopes);
  if (namespaces.length === 0) return [];

  const { baseName } = splitNameAndLeafVariants(variable.name);

  const webSyntax = variable.codeSyntax?.WEB?.trim();
  if (webSyntax) {
    const cssVarName = getCssVarNameFromCodeSyntax(webSyntax);
    const matchedNamespace = TAILWIND_COLOR_NAMESPACES.find(
      (ns) => ns !== "custom" && cssVarName.startsWith(`--${ns}-`)
    );

    return [
      {
        namespace: matchedNamespace ?? "custom",
        cssVarName,
      },
    ];
  }

  const suffix = getColorSuffixName(variable, baseName);
  return namespaces.map((namespace) => ({
    namespace,
    cssVarName: `--${namespace}-${suffix}`,
  }));
}

function parseModeVariants(
  modeName: string,
  defaultModeName: string
): string[] {
  const normalized = modeName.toLowerCase().trim();
  const defaultNormalized = defaultModeName.toLowerCase().trim();

  // If this is the default mode, no variants
  if (normalized === defaultNormalized) {
    return [];
  }

  // Split by comma to get individual variants, trim whitespace
  const parts = normalized
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  // Filter out "light" as it's typically the implicit default
  // but keep "dark", "contrast-more", "contrast-less", etc.
  return parts.filter((part) => part !== "light");
}

interface VariantNode {
  vars: { name: string; value: string }[];
  children: Map<string, VariantNode>;
}

function createVariantNode(): VariantNode {
  return { vars: [], children: new Map() };
}

function insertIntoVariantTree(
  root: Map<string, VariantNode>,
  variants: string[],
  vars: { name: string; value: string }[]
): void {
  if (variants.length === 0) return;

  const [first, ...rest] = variants;

  if (!root.has(first)) {
    root.set(first, createVariantNode());
  }

  const node = root.get(first)!;

  if (rest.length === 0) {
    // This is the target level, add vars here
    node.vars.push(...vars);
  } else {
    // Recurse into children
    insertIntoVariantTree(node.children, rest, vars);
  }
}

function emitVariantTree(
  cssOutput: string[],
  tree: Map<string, VariantNode>
): void {
  if (tree.size === 0) return;

  const emitNode = (variantName: string, node: VariantNode, indent: string) => {
    cssOutput.push(`${indent}@variant ${variantName} {`);

    for (const { name, value } of node.vars) {
      cssOutput.push(`${indent}  ${name}: ${value};`);
    }

    for (const [childVariant, childNode] of node.children) {
      emitNode(childVariant, childNode, `${indent}  `);
    }

    cssOutput.push(`${indent}}`);
  };

  cssOutput.push(":root, :host {");
  for (const [variantName, node] of tree) {
    emitNode(variantName, node, "  ");
  }
  cssOutput.push("}");
}

function isOpacityVariant(variableName: string): boolean {
  const opacityPattern = /\/\d+$/;
  return opacityPattern.test(variableName);
}

function isNegativeSpacingToken(variableName: string): boolean {
  // Tailwind provides negative spacing utilities automatically (e.g. `-m-1`),
  // so designers shouldn't need to create separate `spacing/-1` tokens in Figma.
  if (variableName.startsWith("@utility/")) return false;

  const segments = variableName.split("/");
  if (segments.length < 2) return false;

  const namespace = sanitizeName(segments[0]);
  if (namespace !== "spacing") return false;

  return segments[1].trim().startsWith("-");
}

function isCustomVariantCollection(collectionName: string): boolean {
  return collectionName.trim() === "@custom-variant";
}

function parseVariableName(name: string): {
  baseName: string;
  leafVariants: string[];
} {
  const segments = name.split("/");
  const variantIdx = segments.indexOf("@variant");
  if (variantIdx > 0 && variantIdx < segments.length - 1) {
    const baseSegments = segments.slice(0, variantIdx);
    const baseName = normalizeTailwindCssVarName(
      `--${sanitizeName(baseSegments.join("-"))}`
    );
    // Support comma-separated variants after @variant
    const leafVariants = segments[variantIdx + 1]
      .split(",")
      .map((v) => sanitizeName(v.trim()))
      .filter(Boolean);
    return { baseName, leafVariants };
  }
  // No @variant, treat as regular theme token
  return { baseName: normalizeTailwindCssVarName(`--${sanitizeName(name)}`), leafVariants: [] };
}

function variableNameToCssVar(name: string): string {
  if (name.startsWith("--")) {
    return normalizeTailwindCssVarName(name);
  }
  const sanitized = sanitizeName(name);
  return normalizeTailwindCssVarName(`--${sanitized}`);
}

function getNamespaceFromVariableName(variableName: string): string | null {
  const name = variableName.startsWith("--")
    ? variableName.slice(2)
    : variableName;
  const parts = name.split(/[-/]/);
  if (parts.length >= 2) {
    return parts[0].toLowerCase();
  }
  return null;
}

function getPreferredColorAliasCssVarName(
  aliasedVar: Variable,
  requestedNamespace: TailwindColorNamespace | null,
  variableMetaMap: Map<string, VariableMeta>
): string | null {
  const meta = variableMetaMap.get(aliasedVar.id);
  if (!meta) return null;
  if (meta.hiddenFromPublishing) return null;

  const emissions = meta.colorEmissions;
  if (emissions.size === 0) return null;

  if (requestedNamespace && emissions.has(requestedNamespace)) {
    return emissions.get(requestedNamespace)!;
  }

  if (emissions.has("color")) {
    return emissions.get("color")!;
  }

  return emissions.values().next().value ?? null;
}

async function convertValueToCss(
  value: VariableValue,
  resolvedType: string,
  variableMap: Map<string, Variable>,
  variableMetaMap: Map<string, VariableMeta>,
  variableName: string,
  modeId: string,
  targetColorNamespace: TailwindColorNamespace | null,
  visitedAliasIds: Set<string> = new Set()
): Promise<string> {
  // Handle aliases
  if (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "VARIABLE_ALIAS"
  ) {
    const aliasedVar = variableMap.get(value.id);
    if (!aliasedVar) return "var(--unknown)";

    if (visitedAliasIds.has(aliasedVar.id)) {
      return "var(--circular-alias)";
    }

    const nextVisited = new Set(visitedAliasIds);
    nextVisited.add(aliasedVar.id);

    const aliasedValue =
      aliasedVar.valuesByMode[modeId] ?? Object.values(aliasedVar.valuesByMode)[0];

    // Special-case: Tailwind opacity variants (e.g. color/white/4) are skipped
    // from theme output, so always inline them.
    if (aliasedVar.resolvedType === "COLOR" && isOpacityVariant(aliasedVar.name)) {
      return convertValueToCss(
        aliasedValue,
        aliasedVar.resolvedType,
        variableMap,
        variableMetaMap,
        aliasedVar.name,
        modeId,
        targetColorNamespace,
        nextVisited
      );
    }

    if (aliasedVar.resolvedType === "COLOR") {
      const cssVarName = getPreferredColorAliasCssVarName(
        aliasedVar,
        targetColorNamespace,
        variableMetaMap
      );

      // If the referenced variable isn't part of the Tailwind theme output
      // (hidden from publishing or missing scopes), inline its literal value.
      if (!cssVarName) {
        return convertValueToCss(
          aliasedValue,
          aliasedVar.resolvedType,
          variableMap,
          variableMetaMap,
          aliasedVar.name,
          modeId,
          targetColorNamespace,
          nextVisited
        );
      }

      return `var(${cssVarName})`;
    }

    const cssVarName = variableNameToCssVar(aliasedVar.name);
    return `var(${cssVarName})`;
  }

  const namespace = getNamespaceFromVariableName(variableName);

  switch (resolvedType) {
    case "COLOR":
      if (typeof value === "object" && "r" in value) {
        const rgb = value as RGB | RGBA;
        const rgba: RGBA = {
          r: rgb.r,
          g: rgb.g,
          b: rgb.b,
          a: "a" in rgb ? rgb.a : 1,
        };
        return rgbToOklch(rgba);
      }
      return String(value);
    case "FLOAT":
      if (typeof value === "number") {
        if (namespace === "opacity") {
          return `${Math.round(value * 100)}%`;
        }
        if (namespace === "font" && variableName.includes("weight")) {
          return String(Math.round(value));
        }
        if (namespace === "z") {
          return String(Math.round(value));
        }
        if (namespace === "leading") {
          if (value < 10) {
            return value.toFixed(2).replace(/\.?0+$/, "");
          }
          return `${value}px`;
        }
        if (namespace === "aspect") {
          return String(value);
        }
        if (namespace === "duration" || namespace === "delay") {
          return `${value}ms`;
        }
        if (
          [
            "spacing",
            "text",
            "radius",
            "container",
            "width",
            "height",
            "blur",
            "perspective",
            "breakpoint",
          ].includes(namespace || "")
        ) {
          if (value >= 1) {
            return `${(value / 16).toFixed(3).replace(/\.?0+$/, "")}rem`;
          }
          return `${value}px`;
        }
        return `${value}px`;
      }
      return String(value);
    case "STRING":
      return String(value);
    case "BOOLEAN":
      return value ? "1" : "0";
    default:
      return String(value);
  }
}

figma.codegen.on("generate", async () => {
  try {
    const collections =
      await figma.variables.getLocalVariableCollectionsAsync();

    if (collections.length === 0) {
      return [
        {
          language: "CSS",
          code: '/* No variable collections found in this file */\n@import "tailwindcss";',
          title: "Tailwind v4 Theme",
        },
      ];
    }

    // Build a map of all variables for alias resolution
    const variableMap = new Map<string, Variable>();
    const variableMetaMap = new Map<string, VariableMeta>();

    const allVariables = await figma.variables.getLocalVariablesAsync();
    for (const variable of allVariables) {
      variableMap.set(variable.id, variable);

      const colorEmissions = new Map<TailwindColorNamespace, string>();
      for (const emission of getColorEmissions(variable)) {
        colorEmissions.set(emission.namespace, emission.cssVarName);
      }

      variableMetaMap.set(variable.id, {
        hiddenFromPublishing: variable.hiddenFromPublishing,
        scopes: variable.scopes ?? [],
        codeSyntaxWeb: variable.codeSyntax?.WEB,
        colorEmissions,
      });
    }

    // Categorize collections
    const customVariantCollections: VariableCollection[] = [];
    const regularCollections: VariableCollection[] = [];

    for (const collection of collections) {
      if (isCustomVariantCollection(collection.name)) {
        customVariantCollections.push(collection);
      } else {
        regularCollections.push(collection);
      }
    }

    const cssOutput: string[] = ['@import "tailwindcss";', ""];

    // Process @custom-variant collections (output the selector definitions)
    for (const collection of customVariantCollections) {
      const mode = collection.modes[0];

      for (const variableId of collection.variableIds) {
        const variable = await figma.variables.getVariableByIdAsync(variableId);
        if (!variable) continue;

        const value = variable.valuesByMode[mode.modeId];
        if (value === undefined || variable.resolvedType !== "STRING") continue;

        const variantName = sanitizeName(variable.name);
        const selector = String(value);

        cssOutput.push(`@custom-variant ${variantName} ${selector};`);
      }
    }

    if (customVariantCollections.length > 0) {
      cssOutput.push("");
    }

    // Option: generate @utility blocks for variant utility class output
    const generateUtilityVariantBlocks = true; // TODO: make this configurable
    const themeVars: { name: string; value: string }[] = [];
    const variantTree: Map<string, VariantNode> = new Map();
    const utilityVariantMap: Record<
      string,
      { [variant: string]: { name: string; value: string }[] }
    > = {};

    for (const collection of regularCollections) {
      const defaultMode =
        collection.modes.find((m) => m.modeId === collection.defaultModeId) ||
        collection.modes[0];
      const modeByName = new Map<string, { modeId: string; name: string }>();
      for (const m of collection.modes) {
        modeByName.set(m.name.toLowerCase().trim(), m);
      }

      for (const mode of collection.modes) {
        const isDefault = mode.modeId === defaultMode.modeId;
        const rootVariants = parseModeVariants(mode.name, defaultMode.name);
        let compareMode = defaultMode;
        if (!isDefault && rootVariants.length > 1) {
          const parentVariants = rootVariants.slice(0, -1);
          const parentModeName = parentVariants.join(",");
          const parentMode = modeByName.get(parentModeName);
          if (parentMode) {
            compareMode = parentMode;
          }
        }

        for (const variableId of collection.variableIds) {
          const variable = await figma.variables.getVariableByIdAsync(
            variableId
          );
          if (!variable) continue;

          const value = variable.valuesByMode[mode.modeId];
          const compareValue = variable.valuesByMode[compareMode.modeId];
          if (value === undefined) continue;

          if (!["COLOR", "FLOAT", "STRING"].includes(variable.resolvedType)) {
            continue;
          }

          if (variable.resolvedType === "FLOAT" && isNegativeSpacingToken(variable.name)) {
            continue;
          }

          if (
            variable.resolvedType === "COLOR" &&
            isOpacityVariant(variable.name)
          ) {
            continue;
          }

          // Parse as utility-scoped variable if applicable
          const utilParse = parseUtilityVariableName(variable.name);

          if (utilParse && utilParse.canonicalVarSegments.length > 0) {
            const baseName = getCanonicalVarName(utilParse.canonicalVarSegments);

            const targetColorNamespace = TAILWIND_COLOR_NAMESPACES.includes(
              utilParse.canonicalVarSegments[0] as TailwindColorNamespace
            )
              ? (utilParse.canonicalVarSegments[0] as TailwindColorNamespace)
              : null;

            if (variable.resolvedType === "COLOR") {
              const meta = variableMetaMap.get(variable.id);
              if (!meta || meta.colorEmissions.size === 0) continue;
            }

            const cssValue = await convertValueToCss(
              value,
              variable.resolvedType,
              variableMap,
              variableMetaMap,
              variable.name,
              mode.modeId,
              targetColorNamespace
            );

            const compareCssValue =
              compareValue !== undefined
                ? await convertValueToCss(
                    compareValue,
                    variable.resolvedType,
                    variableMap,
                    variableMetaMap,
                    variable.name,
                    compareMode.modeId,
                    targetColorNamespace
                  )
                : null;

            const leafVariants = getSanitizedVariants(utilParse.variant);
            for (const leafVariant of leafVariants) {
              if (!utilityVariantMap[utilParse.utilityName])
                utilityVariantMap[utilParse.utilityName] = {};
              if (!utilityVariantMap[utilParse.utilityName][leafVariant])
                utilityVariantMap[utilParse.utilityName][leafVariant] = [];
              if (isDefault || cssValue !== compareCssValue) {
                utilityVariantMap[utilParse.utilityName][leafVariant].push({
                  name: baseName,
                  value: cssValue,
                });
              }
            }
            continue;
          }

          // Scope-driven Tailwind colors
          if (variable.resolvedType === "COLOR") {
            const meta = variableMetaMap.get(variable.id);
            if (!meta || meta.colorEmissions.size === 0) continue;

            const { leafVariants } = splitNameAndLeafVariants(variable.name);

            for (const [namespace, emittedName] of meta.colorEmissions) {
              const cssValue = await convertValueToCss(
                value,
                variable.resolvedType,
                variableMap,
                variableMetaMap,
                variable.name,
                mode.modeId,
                namespace
              );

              const compareCssValue =
                compareValue !== undefined
                  ? await convertValueToCss(
                      compareValue,
                      variable.resolvedType,
                      variableMap,
                      variableMetaMap,
                      variable.name,
                      compareMode.modeId,
                      namespace
                    )
                  : null;

              if (isDefault) {
                if (leafVariants.length > 0) {
                  insertIntoVariantTree(variantTree, leafVariants, [
                    { name: emittedName, value: cssValue },
                  ]);
                } else {
                  themeVars.push({ name: emittedName, value: cssValue });
                }
              } else {
                if (cssValue !== compareCssValue) {
                  const fullVariantPath =
                    leafVariants.length > 0
                      ? [...rootVariants, ...leafVariants]
                      : rootVariants;
                  insertIntoVariantTree(variantTree, fullVariantPath, [
                    { name: emittedName, value: cssValue },
                  ]);
                }
              }
            }
            continue;
          }

          // Fallback to normal theme/variant logic
          const { baseName, leafVariants } = parseVariableName(variable.name);
          const cssValue = await convertValueToCss(
            value,
            variable.resolvedType,
            variableMap,
            variableMetaMap,
            variable.name,
            mode.modeId,
            null
          );

          const compareCssValue =
            compareValue !== undefined
              ? await convertValueToCss(
                  compareValue,
                  variable.resolvedType,
                  variableMap,
                  variableMetaMap,
                  variable.name,
                  compareMode.modeId,
                  null
                )
              : null;

          if (isDefault) {
            if (leafVariants.length > 0) {
              insertIntoVariantTree(variantTree, leafVariants, [
                { name: baseName, value: cssValue },
              ]);
            } else {
              themeVars.push({ name: baseName, value: cssValue });
            }
          } else {
            if (cssValue !== compareCssValue) {
              const fullVariantPath =
                leafVariants.length > 0
                  ? [...rootVariants, ...leafVariants]
                  : rootVariants;
              insertIntoVariantTree(variantTree, fullVariantPath, [
                { name: baseName, value: cssValue },
              ]);
            }
          }
        }
      }
    }

    // Output @theme block for theme variables
    if (themeVars.length > 0) {
      cssOutput.push("@theme {");
      for (const { name, value } of themeVars) {
        cssOutput.push(`  ${name}: ${value};`);
      }
      cssOutput.push("}");
    }

    // Output mode/leaf variants (e.g. dark mode overrides)
    if (variantTree.size > 0) {
      cssOutput.push("");
      emitVariantTree(cssOutput, variantTree);
    }

    // Output @utility blocks for utility-scoped variables
    if (
      generateUtilityVariantBlocks &&
      Object.keys(utilityVariantMap).length > 0
    ) {
      cssOutput.push("");
      for (const utilityName of Object.keys(utilityVariantMap)) {
        cssOutput.push(`@utility ${utilityName} {`);
        const variants = utilityVariantMap[utilityName];
        for (const variantName of Object.keys(variants)) {
          cssOutput.push(`  @variant ${variantName} {`);
          for (const { name, value } of variants[variantName]) {
            cssOutput.push(`    ${name}: ${value};`);
          }
          cssOutput.push("  }");
        }
        cssOutput.push("}");
      }
    }

    // Generate debug output
    const debugOutput = {
      collections: await Promise.all(
        collections.map(async (collection) => ({
          name: collection.name,
          isCustomVariant: isCustomVariantCollection(collection.name),
          modes: collection.modes,
          defaultModeId: collection.defaultModeId,
          variables: await Promise.all(
            collection.variableIds.map(async (id) => {
              const v = await figma.variables.getVariableByIdAsync(id);
              return v
                  ? {
                      name: v.name,
                      resolvedType: v.resolvedType,
                      hiddenFromPublishing: v.hiddenFromPublishing,
                      scopes: v.scopes ?? [],
                      codeSyntax: v.codeSyntax,
                      valuesByMode: v.valuesByMode,
                      parsed: parseVariableName(v.name),
                      tailwind: {
                        colorEmissions: Array.from(
                          variableMetaMap.get(v.id)?.colorEmissions ?? []
                        ),
                      },
                    }
                  : null;
            })
          ),
        }))
      ),
    };

    return [
      {
        language: "CSS",
        code: cssOutput.join("\n"),
        title: "Tailwind v4 Theme",
      },
      {
        language: "JSON",
        code: JSON.stringify(debugOutput, null, 2),
        title: "Variables (Debug)",
      },
    ];
  } catch (error) {
    return [
      {
        language: "PLAINTEXT",
        code: `Error: ${
          error instanceof Error ? error.message : String(error)
        }`,
        title: "Error",
      },
    ];
  }
});
