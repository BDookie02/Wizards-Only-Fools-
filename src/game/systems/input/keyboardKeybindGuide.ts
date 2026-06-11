export type KeyboardKeybindGuideGroup = {
  title: string;
  rows: [action: string, bind: string][];
};

export const keyboardKeybindRows: KeyboardKeybindGuideGroup[] = [
  {
    title: "Keyboard",
    rows: [
      ["Move", "W A S D"],
      ["Look", "Mouse / optional arrow keys"],
      ["Left Cast", "Mouse 1"],
      ["Right Cast", "Mouse 2 or hold Q + Mouse 1"],
      ["Spell Book", "E"],
      ["Interact", "F"],
      ["Inventory", "I"],
      ["Map", "M"],
      ["Player List", "Tab"],
      ["Hotbar", "1-0, hold Q for right hand"],
      ["Voice Push-To-Talk", "V by default"],
      ["Jump / Thruster", "Space"],
      ["Sprint", "Shift"],
      ["Slide", "C"],
    ],
  },
];
