export type FieldNote = {
  slug: string;
  number: string;
  title: string;
  summary: string;
  published: string;
  datePublished: string;
  readTime: string;
  sections: { heading: string; paragraphs: string[]; bullets?: string[] }[];
  sources: { label: string; href: string }[];
};

export const fieldNotes: FieldNote[] = [
  {
    slug: "five-reasons-policies-fail-to-transfer",
    number: "01",
    title: "Five reasons robot policies fail to transfer",
    summary: "A baseline synthesis of public LeRobot reports and cross-embodiment research, published before our first interview cycle so practitioners can challenge it.",
    published: "September 8, 2026",
    datePublished: "2026-09-08",
    readTime: "6 min",
    sections: [
      { heading: "Transfer is a configuration problem before it is a model problem", paragraphs: ["A policy is usually discussed as though its weights contain the whole behavior. In practice, behavior emerges from a policy combined with calibration, sensor placement, action conventions, control timing, dependencies, and the physical task definition. A mismatch in any one layer can invalidate the result.", "Public LeRobot reports show that even calibration files and identifiers can determine whether an otherwise valid workflow moves safely. That makes configuration provenance part of the executable artifact, not supplementary documentation."] },
      { heading: "1. Calibration is local and easy to lose", paragraphs: ["The same robot family does not guarantee the same joint offsets, ranges, direction conventions, or gripper behavior. LeRobot stores calibration by robot identifier and requires that identifier to remain consistent across calibration, recording, and evaluation."], bullets: ["Record the calibration method and tool version.", "Identify calibration artifacts by digest without publishing device secrets.", "Distinguish mechanical configuration from software normalization."] },
      { heading: "2. Sensors silently redefine the task", paragraphs: ["Camera location, resolution, frame rate, lens, crop, lighting, and synchronization change the observations available to a policy. A repository that says only “two RGB cameras” has not described a reproducible input contract."] },
      { heading: "3. Action and observation contracts drift", paragraphs: ["A matching tensor shape does not guarantee matching semantics. Joint order, units, normalization, coordinate frames, gripper direction, and end-effector conventions can differ while the software still runs."] },
      { heading: "4. Runtime timing is part of behavior", paragraphs: ["Control frequency, inference latency, dropped frames, and actuator communication affect the closed loop. Reporting model architecture without the runtime envelope can make a successful policy appear portable when it is not."] },
      { heading: "5. Success rates lack a shared denominator", paragraphs: ["A percentage cannot be compared without the task-reset procedure, success rule, trial count, object distribution, intervention policy, and failure handling. Video demonstrates possibility; a protocol and trial record establish repeatability."] },
      { heading: "Our current hypothesis", paragraphs: ["The first useful artifact is a machine-readable transfer record binding an immutable policy revision to a hardware profile, calibration fingerprint, observation/action contract, runtime envelope, and explicit evaluation protocol. This is a hypothesis to test, not a settled standard."] }
    ],
    sources: [
      { label: "LeRobot imitation-learning robot guide", href: "https://github.com/huggingface/lerobot/blob/main/docs/source/il_robots.mdx" },
      { label: "LeRobot calibration failure report #3942", href: "https://github.com/huggingface/lerobot/issues/3942" },
      { label: "LeRobot homing-offset analysis #3587", href: "https://github.com/huggingface/lerobot/issues/3587" },
      { label: "Open X-Embodiment", href: "https://arxiv.org/abs/2310.08864" }
    ]
  },
  {
    slug: "missing-from-policy-repositories",
    number: "02",
    title: "What is missing from most robot-policy repositories",
    summary: "A practical inventory of the evidence needed to decide whether reproducing a policy is feasible before purchasing hardware or spending a week integrating it.",
    published: "September 8, 2026",
    datePublished: "2026-09-08",
    readTime: "5 min",
    sections: [
      { heading: "A repository is not yet a reproducibility record", paragraphs: ["Source code and model weights are necessary, but they do not answer the decision a practitioner actually faces: will this specific artifact run on my specific setup, and what result should I expect?", "The missing information generally falls into six contracts. Each should be explicit, versioned, and separable from prose."] },
      { heading: "The six contracts", paragraphs: ["A useful transfer record describes the artifact, embodiment, sensing, action, runtime, and evaluation contracts."], bullets: ["Artifact: immutable source, weights, dataset, container, license, and dependency revisions.", "Embodiment: robot model, actuators, firmware, end effector, physical modifications, and calibration fingerprint.", "Sensing: camera and sensor models, placement, intrinsics, resolution, rate, transforms, and preprocessing.", "Action: joint order, units, coordinate frames, normalization, clipping, and safety limits.", "Runtime: compute hardware, drivers, inference latency, control frequency, and communication path.", "Evaluation: task definition, reset procedure, success rule, trials, interventions, seeds, and raw evidence."] },
      { heading: "What should remain private", paragraphs: ["Reproducibility does not require publishing credentials, facility layouts, proprietary datasets, serial numbers, human-subject data, or exploitable safety details. The record should support hashes, redacted fields, and controlled evidence while keeping the public claim precise about what was not disclosed."] },
      { heading: "A decision-oriented test", paragraphs: ["A repository is sufficiently described when an independent practitioner can estimate required hardware, integration work, safety constraints, and evaluation cost before downloading large artifacts. Our interviews will test which fields actually change that decision."] }
    ],
    sources: [
      { label: "LeRobot hardware integration guidance", href: "https://huggingface.co/docs/lerobot/main/en/integrate_hardware" },
      { label: "LeRobot SO-101 policy incompatibility report #1387", href: "https://github.com/huggingface/lerobot/issues/1387" },
      { label: "LeRobot open-source stack paper", href: "https://arxiv.org/abs/2602.22818" }
    ]
  },
  {
    slug: "minimum-reproducibility-record",
    number: "03",
    title: "The minimum reproducibility record for manipulation research",
    summary: "A deliberately small proposed record that can live beside an existing GitHub or Hugging Face repository without forcing anyone onto a new platform.",
    published: "September 8, 2026",
    datePublished: "2026-09-08",
    readTime: "7 min",
    sections: [
      { heading: "Start with the smallest record that can disprove a claim", paragraphs: ["A first specification should not attempt to describe every robot. It should capture enough information to tell two genuinely different experiments apart and make failures diagnosable.", "The record belongs in the contributor’s existing repository. A registry should index and verify it, not demand custody of the policy."] },
      { heading: "Required identity", paragraphs: ["Every result should bind to immutable revisions of the policy, manifest, benchmark, dataset where applicable, and execution environment. Human-readable version tags are useful, but content digests prevent a tag from changing underneath a result."] },
      { heading: "Required configuration", paragraphs: ["For low-cost LeRobot manipulation, the initial record should capture robot family, leader/follower configuration, end effector, motor and firmware family, calibration fingerprint, sensor arrangement, observation/action schema, control rate, compute target, and relevant dependency lockfile."] },
      { heading: "Required evaluation evidence", paragraphs: ["A result needs a named benchmark version, explicit success predicate, trial and success counts, intervention count, reset procedure, evaluator identity, timestamps, and evidence hashes. The platform should derive the displayed percentage from counts rather than accepting an unexplained percentage."] },
      { heading: "Trust must be graduated", paragraphs: ["Self-tested, independently reproduced, controlled-runner verified, and laboratory verified are different claims. Displaying them as levels lets the network grow before formal certification exists without pretending every submission has equal assurance."] },
      { heading: "The interview question behind every field", paragraphs: ["For each proposed field we will ask: did this information affect whether you could reproduce the policy or diagnose the failure? Fields that never change a decision should not burden contributors. Missing fields that repeatedly cost time become required."] }
    ],
    sources: [
      { label: "Open X-Embodiment standardized datasets", href: "https://arxiv.org/abs/2310.08864" },
      { label: "LeRobot robot interface", href: "https://huggingface.co/docs/lerobot/main/api/robots" },
      { label: "MCAP multimodal robotics logs", href: "https://mcap.dev/" }
    ]
  },
  {
    slug: "what-the-validator-cannot-infer",
    number: "04",
    title: "What the first robot-skill validator cannot infer",
    summary: "Release notes from turning the proposed reproducibility record into a working local inspector—and the evidence automation must not pretend to know.",
    published: "September 8, 2026",
    datePublished: "2026-09-08",
    readTime: "4 min",
    sections: [
      { heading: "Automation should expose uncertainty", paragraphs: ["Version 1.0 can inventory configuration files, dependency declarations, repository identity, common framework and architecture markers, robot names, dataset references, shapes, sensors, and control frequency. It writes what it finds into a portable manifest.", "It deliberately uses null values and explicit findings when evidence is missing. Guessing a gripper, framework version, calibration, or success rate would make a clean-looking record less trustworthy than an incomplete one."] },
      { heading: "The hardest evidence is experiential", paragraphs: ["A repository scan cannot prove that a policy ran, that an adapter preserves action semantics, or that a reported result followed a particular reset and success protocol. Compatibility and evaluations therefore require evidence supplied by a practitioner; the tool never converts textual similarity into a verified claim."] },
      { heading: "Repository conventions are inconsistent", paragraphs: ["The first implementation recognizes several common JSON keys, README markers, dependency files, and Git metadata. That catches straightforward LeRobot-style layouts, but custom Hydra trees and Python-constructed configurations may remain opaque because the inspector never imports or executes target code."], bullets: ["Safe inspection takes priority over maximal inference.", "Stable finding codes make failures usable in CI and bug reports.", "Ten representative layouts protect the current detection contract; real-world reports will determine the next adapters."] },
      { heading: "The useful output is the missing list", paragraphs: ["The validator is valuable before it can fill every field. A maintainer can run it, commit the draft, and resolve a finite list of absent claims. Another team can inspect the same record before buying hardware or beginning integration."] }
    ],
    sources: [
      { label: "robot-skill 1.0 implementation", href: "https://github.com/arcofdescent1/knownrobot/tree/v1.0.0/robot_skill" },
      { label: "robot-skill 1.0 schema", href: "https://github.com/arcofdescent1/knownrobot/blob/v1.0.0/embodied-registry/schema/robot-skill.schema.json" },
      { label: "Validator test suite", href: "https://github.com/arcofdescent1/knownrobot/blob/v1.0.0/tests/test_cli.py" }
    ]
  }
];

export function getFieldNote(slug: string) { return fieldNotes.find((note) => note.slug === slug); }
