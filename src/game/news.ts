const KIND_LABELS: Record<string, string> = {
  result: "Match report",
  injury: "Injury",
  suspension: "Suspension",
  transfer: "Transfer",
  award: "Award",
  intake: "Youth intake",
  info: "Club",
};

export function newsKindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind;
}
