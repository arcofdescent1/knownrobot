type JsonLdValue = Record<string, unknown> | Record<string, unknown>[];

export function StructuredData({ value }: { value: JsonLdValue }) {
  // Escaping `<` prevents user-controlled strings from terminating the script tag.
  const json = JSON.stringify(value).replaceAll("<", "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
