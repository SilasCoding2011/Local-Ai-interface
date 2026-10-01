function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function highlightCode(code: string) {
  const expression = /(\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:const|let|var|function|return|export|default|import|from|type|interface|async|await|if|else|new|class|extends|true|false|null|undefined|map|useState|useEffect)\b|\b\d+\b|<\/?[A-Za-z][^>]*>|[{}()[\];,.])/g;
  let output = "";
  let lastIndex = 0;
  for (const match of code.matchAll(expression)) {
    const token = match[0];
    const index = match.index ?? 0;
    output += escapeHtml(code.slice(lastIndex, index));
    const className = token.startsWith("//") ? "tok-comment" : token.startsWith("\"") || token.startsWith("'") || token.startsWith("`") ? "tok-string" : /^\d+$/.test(token) ? "tok-number" : token.startsWith("<") ? "tok-tag" : /^[{}()[\];,.]$/.test(token) ? "tok-punctuation" : "tok-keyword";
    output += `<span class="${className}">${escapeHtml(token)}</span>`;
    lastIndex = index + token.length;
  }
  return output + escapeHtml(code.slice(lastIndex));
}
