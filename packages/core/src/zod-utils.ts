import { z, type ZodObject, type ZodRawShape, type ZodTypeAny } from "zod";

/**
 * Minimal Zod → JSON-Schema description, sufficient to brief an LLM and to
 * hash a schema for the code-gen recipe cache. Covers the shapes extraction
 * schemas actually use; unknown types degrade to `{}` (accept anything).
 */
export function describeZodSchema(schema: ZodTypeAny): Record<string, unknown> {
  const def = (schema as unknown as { _def: Record<string, unknown> })._def;
  const typeName = def.typeName as string | undefined;

  switch (typeName) {
    case "ZodString":
      return { type: "string" };
    case "ZodNumber":
      return { type: "number" };
    case "ZodBoolean":
      return { type: "boolean" };
    case "ZodLiteral":
      return { const: def.value };
    case "ZodEnum":
      return { type: "string", enum: def.values as string[] };
    case "ZodArray":
      return {
        type: "array",
        items: describeZodSchema(def.type as ZodTypeAny),
      };
    case "ZodObject": {
      const shape = (schema as unknown as ZodObject<ZodRawShape>).shape;
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [key, field] of Object.entries(shape)) {
        properties[key] = describeZodSchema(field as ZodTypeAny);
        if (!isOptionalField(field as ZodTypeAny)) required.push(key);
      }
      return { type: "object", properties, required };
    }
    case "ZodOptional":
    case "ZodNullable":
    case "ZodDefault":
      return describeZodSchema(def.innerType as ZodTypeAny);
    case "ZodEffects":
      return describeZodSchema(def.schema as ZodTypeAny);
    default:
      return {};
  }
}

function isOptionalField(schema: ZodTypeAny): boolean {
  const def = (schema as unknown as { _def: Record<string, unknown> })._def;
  const typeName = def.typeName as string | undefined;
  if (typeName === "ZodOptional" || typeName === "ZodDefault") return true;
  if (typeName === "ZodEffects") {
    return isOptionalField(def.schema as ZodTypeAny);
  }
  return false;
}

/** Unwrap optional/nullable/default/effects to reach the core type. */
export function unwrapZod(schema: ZodTypeAny): ZodTypeAny {
  const def = (schema as unknown as { _def: Record<string, unknown> })._def;
  const typeName = def.typeName as string | undefined;
  if (
    typeName === "ZodOptional" ||
    typeName === "ZodNullable" ||
    typeName === "ZodDefault"
  ) {
    return unwrapZod(def.innerType as ZodTypeAny);
  }
  if (typeName === "ZodEffects") return unwrapZod(def.schema as ZodTypeAny);
  return schema;
}

export type FieldKind =
  | "string"
  | "number"
  | "boolean"
  | "array"
  | "object"
  | "unknown";

/** Top-level field kinds of an object schema, for code-gen value coercion. */
export function fieldKinds(
  schema: ZodObject<ZodRawShape>,
): Record<string, FieldKind> {
  const kinds: Record<string, FieldKind> = {};
  for (const [key, field] of Object.entries(schema.shape)) {
    const core = unwrapZod(field as ZodTypeAny);
    const typeName = (
      core as unknown as { _def: Record<string, unknown> }
    )._def.typeName as string | undefined;
    kinds[key] =
      typeName === "ZodString"
        ? "string"
        : typeName === "ZodNumber"
          ? "number"
          : typeName === "ZodBoolean"
            ? "boolean"
            : typeName === "ZodArray"
              ? "array"
              : typeName === "ZodObject"
                ? "object"
                : typeName === "ZodEnum" || typeName === "ZodLiteral"
                  ? "string"
                  : "unknown";
  }
  return kinds;
}

/**
 * Build a Zod schema from a JSON Schema subset — this is what the CLI
 * accepts via `--schema-json`, so terminal users never write TypeScript.
 */
export function jsonSchemaToZod(json: Record<string, unknown>): ZodTypeAny {
  const enumValues = json.enum as string[] | undefined;
  if (enumValues && enumValues.length > 0) {
    return z.enum(enumValues as [string, ...string[]]);
  }
  switch (json.type) {
    case "string":
      return z.string();
    case "number":
    case "integer":
      return z.number();
    case "boolean":
      return z.boolean();
    case "array": {
      const items = json.items as Record<string, unknown> | undefined;
      return z.array(items ? jsonSchemaToZod(items) : z.unknown());
    }
    case "object": {
      const properties = (json.properties ?? {}) as Record<
        string,
        Record<string, unknown>
      >;
      const required = new Set((json.required ?? []) as string[]);
      const shape: ZodRawShape = {};
      for (const [key, propSchema] of Object.entries(properties)) {
        const field = jsonSchemaToZod(propSchema);
        shape[key] = required.has(key) ? field : field.optional();
      }
      return z.object(shape);
    }
    default:
      return z.unknown();
  }
}
