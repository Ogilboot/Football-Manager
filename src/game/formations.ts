import type { Formation } from "./types";

export const FORMATIONS: Formation[] = [
  {
    id: "4-4-2",
    name: "4-4-2",
    slots: [
      { roleId: "gk", x: 5, y: 50 },
      { roleId: "fb", x: 28, y: 15 },
      { roleId: "cb", x: 24, y: 38 },
      { roleId: "cb", x: 24, y: 62 },
      { roleId: "fb", x: 28, y: 85 },
      { roleId: "wm", x: 52, y: 12 },
      { roleId: "cm", x: 48, y: 38 },
      { roleId: "cm", x: 48, y: 62 },
      { roleId: "wm", x: 52, y: 88 },
      { roleId: "st", x: 78, y: 38 },
      { roleId: "st", x: 78, y: 62 },
    ],
  },
  {
    id: "4-3-3",
    name: "4-3-3",
    slots: [
      { roleId: "gk", x: 5, y: 50 },
      { roleId: "fb", x: 28, y: 15 },
      { roleId: "cb", x: 24, y: 38 },
      { roleId: "cb", x: 24, y: 62 },
      { roleId: "fb", x: 28, y: 85 },
      { roleId: "cm", x: 52, y: 30 },
      { roleId: "dm", x: 46, y: 50 },
      { roleId: "cm", x: 52, y: 70 },
      { roleId: "winger", x: 80, y: 20 },
      { roleId: "st", x: 82, y: 50 },
      { roleId: "winger", x: 80, y: 80 },
    ],
  },
  {
    id: "4-2-3-1",
    name: "4-2-3-1",
    slots: [
      { roleId: "gk", x: 5, y: 50 },
      { roleId: "fb", x: 28, y: 15 },
      { roleId: "cb", x: 24, y: 38 },
      { roleId: "cb", x: 24, y: 62 },
      { roleId: "fb", x: 28, y: 85 },
      { roleId: "dm", x: 46, y: 40 },
      { roleId: "dm", x: 46, y: 60 },
      { roleId: "winger", x: 70, y: 18 },
      { roleId: "am", x: 68, y: 50 },
      { roleId: "winger", x: 70, y: 82 },
      { roleId: "st", x: 85, y: 50 },
    ],
  },
  {
    id: "3-5-2",
    name: "3-5-2",
    slots: [
      { roleId: "gk", x: 5, y: 50 },
      { roleId: "cb", x: 24, y: 30 },
      { roleId: "cb", x: 22, y: 50 },
      { roleId: "cb", x: 24, y: 70 },
      { roleId: "wm", x: 52, y: 10 },
      { roleId: "cm", x: 48, y: 38 },
      { roleId: "cm", x: 46, y: 50 },
      { roleId: "cm", x: 48, y: 62 },
      { roleId: "wm", x: 52, y: 90 },
      { roleId: "st", x: 78, y: 40 },
      { roleId: "st", x: 78, y: 60 },
    ],
  },
  {
    id: "5-3-2",
    name: "5-3-2",
    slots: [
      { roleId: "gk", x: 5, y: 50 },
      { roleId: "wb", x: 28, y: 10 },
      { roleId: "cb", x: 22, y: 30 },
      { roleId: "cb", x: 20, y: 50 },
      { roleId: "cb", x: 22, y: 70 },
      { roleId: "wb", x: 28, y: 90 },
      { roleId: "cm", x: 50, y: 30 },
      { roleId: "cm", x: 48, y: 50 },
      { roleId: "cm", x: 50, y: 70 },
      { roleId: "st", x: 78, y: 40 },
      { roleId: "st", x: 78, y: 60 },
    ],
  },
  {
    id: "4-1-2-1-2",
    name: "4-1-2-1-2",
    slots: [
      { roleId: "gk", x: 5, y: 50 },
      { roleId: "fb", x: 28, y: 15 },
      { roleId: "cb", x: 24, y: 38 },
      { roleId: "cb", x: 24, y: 62 },
      { roleId: "fb", x: 28, y: 85 },
      { roleId: "dm", x: 44, y: 50 },
      { roleId: "cm", x: 52, y: 35 },
      { roleId: "cm", x: 52, y: 65 },
      { roleId: "am", x: 66, y: 50 },
      { roleId: "st", x: 80, y: 38 },
      { roleId: "st", x: 80, y: 62 },
    ],
  },
  {
    id: "3-4-3",
    name: "3-4-3",
    slots: [
      { roleId: "gk", x: 5, y: 50 },
      { roleId: "cb", x: 24, y: 30 },
      { roleId: "cb", x: 22, y: 50 },
      { roleId: "cb", x: 24, y: 70 },
      { roleId: "wm", x: 52, y: 10 },
      { roleId: "cm", x: 48, y: 38 },
      { roleId: "cm", x: 48, y: 62 },
      { roleId: "wm", x: 52, y: 90 },
      { roleId: "winger", x: 78, y: 22 },
      { roleId: "st", x: 82, y: 50 },
      { roleId: "winger", x: 78, y: 78 },
    ],
  },
];

const formationMap = new Map(FORMATIONS.map((f) => [f.id, f]));

export function getFormation(id: string): Formation {
  const f = formationMap.get(id);
  if (!f) throw new Error(`Unknown formation ${id}`);
  return f;
}
