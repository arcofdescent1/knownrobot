import "server-only";
import data from "@/data/adapters.json";
import { adaptersSchema } from "./adapter-contract";
export const adapters = adaptersSchema.parse(data);
