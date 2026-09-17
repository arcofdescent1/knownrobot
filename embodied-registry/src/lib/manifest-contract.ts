import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import schema from "../../schema/robot-skill.schema.json";
import rules from "../../schema/manifest-publication.rules.json";

const ajv = new Ajv2020({ allErrors: true, strict: false, strictNumbers: true });
addFormats(ajv);
const validate = ajv.compile(schema);
type ObjectValue = Record<string, unknown>;
const object = (v: unknown): v is ObjectValue => !!v && typeof v === "object" && !Array.isArray(v);
const at = (v: unknown, path: string): unknown => path.split(".").reduce<unknown>((value, key) => object(value) ? value[key] : undefined, v);
const dimensions = (v: unknown) => Array.isArray(v) && v.length > 0 && v.every(d => typeof d === "number" && Number.isInteger(d) && d > 0);

export function manifestIssues(value: unknown, complete = false): string[] {
  if (!validate(value)) return (validate.errors ?? []).map(e => `manifest${e.instancePath.replaceAll("/", ".")}: ${e.message}`);
  const manifest = value as ObjectValue;
  const errors: string[] = [];
  for (const evaluation of manifest.evaluations as ObjectValue[]) if ((evaluation.successes as number) > (evaluation.trials as number)) errors.push("manifest.evaluations: successes exceed trials");
  for (const path of ["runtime.observation_shape", "runtime.action_shape"]) {
    const features = at(manifest, path);
    if (features !== null && !(object(features) ? Object.values(features).every(v => dimensions(object(v) ? v.shape : v)) : dimensions(features))) errors.push(`manifest.${path}: invalid feature dimensions`);
  }
  const dataset = at(manifest, "dataset.schema");
  if (object(dataset)) for (const feature of Object.values(dataset)) {
    if (object(feature) && feature.shape !== undefined && feature.shape !== null && !(Array.isArray(feature.shape) && feature.shape.every(d => typeof d === "number" && Number.isInteger(d) && d > 0))) errors.push("manifest.dataset.schema: invalid dimensions");
    else if (!object(feature) && typeof feature !== "string" && !Array.isArray(feature)) errors.push("manifest.dataset.schema: invalid feature");
  }
  const dependencies = at(manifest, "runtime.dependencies") as string[];
  const pins = new Map<string, string>();
  for (const dep of dependencies) {
    const pin = dep.match(/^([A-Za-z0-9][A-Za-z0-9._-]*)(?:\[[A-Za-z0-9,._-]+\])?\s*==\s*([^*;\s]+)(?:\s*;\s*(.*))?$/);
    if (pin) {
      const name = `${pin[1].toLowerCase().replace(/[-_.]+/g, "-")};${(pin[3] ?? "").replace(/\s+/g, "").replaceAll("'", '"')}`;
      if (pins.has(name) && pins.get(name) !== pin[2]) errors.push("manifest.runtime.dependencies: conflicting pins");
      pins.set(name, pin[2]);
    }
  }
  if (!complete) return errors;
  for (const path of rules.required) {
    const v = at(manifest, path);
    if (v === null || v === undefined || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && !v.length) || (object(v) && !Object.keys(v).length)) errors.push(`manifest.${path}: incomplete`);
  }
  for (const [path, pattern] of Object.entries(rules.patterns)) if (typeof at(manifest, path) !== "string" || !new RegExp(pattern).test(at(manifest, path) as string)) errors.push(`manifest.${path}: unpinned`);
  for (const path of rules.mappings) if (!object(at(manifest, path))) errors.push(`manifest.${path}: use named mappings`);
  for (const dep of dependencies) if (!new RegExp(rules.dependency_pattern).test(dep)) errors.push("manifest.runtime.dependencies: unpinned");
  if (!dependencies.some(dep => !dep.startsWith("file:") && new RegExp(rules.dependency_pattern).test(dep))) errors.push("manifest.runtime.dependencies: unresolved environment");
  return errors;
}
