import DOMPurify from "dompurify";
export function cleanInlineHtml(html: string) {
  const holder = document.createElement("div");
  holder.innerHTML = DOMPurify.sanitize(html);
  holder.querySelectorAll("div,p").forEach((el) => {
    if (el.previousSibling) el.before(document.createElement("br"));
    el.replaceWith(...Array.from(el.childNodes));
  });
  return DOMPurify.sanitize(holder.innerHTML, {
    ALLOWED_TAGS: [
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "strike",
      "span",
      "font",
      "a",
      "br",
      "sub",
      "sup",
    ],
    ALLOWED_ATTR: ["style", "href", "color", "face", "size"],
  });
}
