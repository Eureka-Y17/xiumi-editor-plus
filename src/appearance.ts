export function styleOf(el: Element) {
  return el.ownerDocument.defaultView!.getComputedStyle(el);
}
export function hasBackground(el: HTMLElement) {
  const style = styleOf(el);
  const color = style.backgroundColor;
  const solid =
    !!color &&
    color !== "transparent" &&
    !/^rgba\([^)]*,\s*0(?:\.0+)?\s*\)$/.test(color);
  return solid || (!!style.backgroundImage && style.backgroundImage !== "none");
}
export function hexColor(color: string, fallback = "#333333") {
  if (/^#[\da-f]{6}$/i.test(color)) return color;
  const values = color.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  return values
    ? "#" +
        values
          .slice(1, 4)
          .map((n) => Math.min(255, +n).toString(16).padStart(2, "0"))
          .join("")
    : fallback;
}
export interface TextRun {
  node: Text | HTMLBRElement;
  start: number;
  end: number;
}
export function textRuns(el: HTMLElement) {
  let text = "";
  const runs: TextRun[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === 3) {
      const value = node.textContent ?? "";
      runs.push({
        node: node as Text,
        start: text.length,
        end: text.length + value.length,
      });
      text += value;
    } else if (node.nodeName === "BR") {
      runs.push({
        node: node as HTMLBRElement,
        start: text.length,
        end: text.length + 1,
      });
      text += "\n";
    } else Array.from(node.childNodes).forEach(walk);
  };
  Array.from(el.childNodes).forEach(walk);
  return { text, runs };
}
// Only the changed text range is replaced; untouched links and inline formatting remain.
export function replaceParagraphText(el: HTMLElement, value: string) {
  const { text, runs } = textRuns(el);
  if (value === text) return;
  let prefix = 0,
    suffix = 0;
  while (
    prefix < text.length &&
    prefix < value.length &&
    text[prefix] === value[prefix]
  )
    prefix++;
  // Keep UTF-16 surrogate pairs together when two emoji share a high surrogate.
  if (prefix > 0 && /[\uD800-\uDBFF]/.test(text[prefix - 1])) prefix--;
  while (
    suffix < text.length - prefix &&
    suffix < value.length - prefix &&
    text[text.length - 1 - suffix] === value[value.length - 1 - suffix]
  )
    suffix++;
  if (suffix > 0 && /[\uDC00-\uDFFF]/.test(text[text.length - suffix])) suffix--;
  const boundary = (position: number): [Node, number] => {
    const run = runs.find((r) => position >= r.start && position <= r.end);
    if (!run) return [el, el.childNodes.length];
    if (run.node.nodeType === 3) return [run.node, position - run.start];
    return [
      run.node.parentNode!,
      Array.from(run.node.parentNode!.childNodes).indexOf(run.node) +
        (position > run.start ? 1 : 0),
    ];
  };
  const range = el.ownerDocument.createRange();
  const [start, startOffset] = boundary(prefix),
    [end, endOffset] = boundary(text.length - suffix);
  range.setStart(start, startOffset);
  range.setEnd(end, endOffset);
  range.deleteContents();
  const fragment = el.ownerDocument.createDocumentFragment();
  value
    .slice(prefix, value.length - suffix)
    .split("\n")
    .forEach((line, i) => {
      if (i) fragment.append(el.ownerDocument.createElement("br"));
      fragment.append(el.ownerDocument.createTextNode(line));
    });
  range.insertNode(fragment);
}
