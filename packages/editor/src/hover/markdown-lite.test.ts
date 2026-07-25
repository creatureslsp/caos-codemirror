import { describe, expect, it } from "vitest";
import { caosMarkdownLiteToHtml } from "./markdown-lite.js";

describe("caosMarkdownLiteToHtml", () => {
  it("renders **bold** as <strong>", () => {
    expect(caosMarkdownLiteToHtml("**ATTR**")).toBe("<strong>ATTR</strong>");
  });

  it("renders formatCaosDocumentation's real output shape end-to-end", () => {
    // vs-caos-editor/packages/caos-util/src/documentation-formattter.ts's
    // actual join: "**COMMAND** (returnType) **param** (type)" + "   \n" +
    // description.
    const input = "**ATTR** (integer) **attributes** (integer)   \nSets the attributes of an object.";
    expect(caosMarkdownLiteToHtml(input)).toBe(
      "<strong>ATTR</strong> (integer) <strong>attributes</strong> (integer)<br>Sets the attributes of an object.",
    );
  });

  it("renders a bare newline (multi-line description) as <br>", () => {
    expect(caosMarkdownLiteToHtml("line one\nline two")).toBe("line one<br>line two");
  });

  it("HTML-escapes content before introducing <strong>/<br> tags", () => {
    expect(caosMarkdownLiteToHtml("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;",
    );
  });

  it("cannot have escaped content re-form a tag around a ** pair", () => {
    // If escaping ran *after* the bold substitution, "<" surviving as a raw
    // character next to an injected "<strong>" could change the DOM
    // structure. Escaping first means this always stays inert text.
    expect(caosMarkdownLiteToHtml("**<b>x</b>**")).toBe("<strong>&lt;b&gt;x&lt;/b&gt;</strong>");
  });

  it("leaves plain text without markdown constructs unchanged", () => {
    expect(caosMarkdownLiteToHtml("no markdown here")).toBe("no markdown here");
  });
});
