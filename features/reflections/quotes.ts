export type Reflection = { text: string; author: string };
export type ReflectionsResponse = {
  quotes: Reflection[];
  source: "zenquotes" | "campo";
};

// Textos originais do aplicativo, sem atribuições a autores históricos.
export const localReflections: Reflection[] = [
  { text: "A closer look often changes the question.", author: "Campo" },
  {
    text: "Leave room in your notes for what you do not yet understand.",
    author: "Campo",
  },
  {
    text: "Attention turns an ordinary walk into an encounter.",
    author: "Campo",
  },
  {
    text: "You can return to the same place and notice something new.",
    author: "Campo",
  },
];
