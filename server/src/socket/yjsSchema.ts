import { Schema } from 'prosemirror-model';

/**
 * ProseMirror schema matching the client-side TipTap StarterKit schema.
 * Used on the server to convert stored TipTap JSON to Yjs XmlFragment content
 * when loading legacy documents for the first time with Yjs collaboration.
 */
export const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { content: 'inline*', group: 'block' },
    text: { group: 'inline' },
    heading: {
      content: 'inline*',
      group: 'block',
      attrs: { level: { default: 1 } },
    },
    blockquote: { content: 'block+', group: 'block' },
    codeBlock: { content: 'text*', group: 'block' },
    horizontalRule: { group: 'block' },
    hardBreak: { inline: true, group: 'inline' },
    orderedList: {
      content: 'listItem+',
      group: 'block',
      attrs: { order: { default: 1 }, start: { default: 1 } },
    },
    bulletList: { content: 'listItem+', group: 'block' },
    listItem: { content: 'paragraph block*' },
  },
  marks: {
    bold: {},
    italic: {},
    strike: {},
    code: {},
    link: { attrs: { href: {} } },
  },
});
