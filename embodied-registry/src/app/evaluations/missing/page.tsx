import type { Metadata } from "next";
import EvaluationNotFound from "../[id]/not-found";

export const metadata: Metadata = {
  title: "Evaluation not found — Known Robot",
  robots: { index: false, follow: true },
};
export default EvaluationNotFound;
