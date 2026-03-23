"use strict";

function countBackslashesBefore(source, index) {
  let count = 0;
  for (let position = index - 1; position >= 0 && source[position] === "\\"; position -= 1) {
    count += 1;
  }
  return count;
}

function findUnescapedDelimiter(source, delimiter, startIndex) {
  let match = source.indexOf(delimiter, startIndex);

  while (match !== -1) {
    if (countBackslashesBefore(source, match) % 2 === 0) {
      return match;
    }
    match = source.indexOf(delimiter, match + delimiter.length);
  }

  return -1;
}

function isValidDollarDelimiter(state, position) {
  const max = state.posMax;
  let canOpen = true;
  let canClose = true;
  const previousChar = position > 0 ? state.src.charCodeAt(position - 1) : -1;
  const nextChar = position + 1 <= max ? state.src.charCodeAt(position + 1) : -1;

  if (previousChar === 32 || previousChar === 9 || (nextChar >= 48 && nextChar <= 57)) {
    canClose = false;
  }
  if (nextChar === 32 || nextChar === 9) {
    canOpen = false;
  }

  return { canClose, canOpen };
}

function createMathRenderer(token, tex2svgHtml) {
  return tex2svgHtml(token.content, { display: Boolean(token.meta && token.meta.display) });
}

function dollarInlineMath(state, silent) {
  if (state.src[state.pos] !== "$") {
    return false;
  }

  let delimiter = isValidDollarDelimiter(state, state.pos);
  if (!delimiter.canOpen) {
    if (!silent) {
      state.pending += "$";
    }
    state.pos += 1;
    return true;
  }

  const start = state.pos + 1;
  let match = start;

  while ((match = state.src.indexOf("$", match)) !== -1) {
    if (countBackslashesBefore(state.src, match) % 2 === 0) {
      break;
    }
    match += 1;
  }

  if (match === -1) {
    if (!silent) {
      state.pending += "$";
    }
    state.pos = start;
    return true;
  }

  if (match === start) {
    if (!silent) {
      state.pending += "$$";
    }
    state.pos = start + 1;
    return true;
  }

  delimiter = isValidDollarDelimiter(state, match);
  if (!delimiter.canClose) {
    if (!silent) {
      state.pending += "$";
    }
    state.pos = start;
    return true;
  }

  if (!silent) {
    const token = state.push("math_inline", "math", 0);
    token.content = state.src.slice(start, match);
    token.markup = "$";
    token.meta = { display: false };
  }

  state.pos = match + 1;
  return true;
}

function bracketInlineMath(state, silent) {
  if (state.src[state.pos] !== "\\" || state.pos + 1 > state.posMax) {
    return false;
  }

  const opener = state.src[state.pos + 1];
  if (opener !== "(" && opener !== "[") {
    return false;
  }

  const closeDelimiter = opener === "(" ? "\\)" : "\\]";
  const start = state.pos + 2;
  const match = findUnescapedDelimiter(state.src, closeDelimiter, start);

  if (match === -1) {
    return false;
  }

  if (match === start) {
    if (!silent) {
      state.pending += `\\${opener}`;
    }
    state.pos = start;
    return true;
  }

  if (!silent) {
    const token = state.push("math_inline", "math", 0);
    token.content = state.src.slice(start, match);
    token.markup = `\\${opener}`;
    token.meta = { display: opener === "[" };
  }

  state.pos = match + closeDelimiter.length;
  return true;
}

function createBlockMathRule(openDelimiter, closeDelimiter, markup) {
  return function blockMath(state, startLine, endLine, silent) {
    let nextLine;
    let lastPosition;
    let found = false;
    let position = state.bMarks[startLine] + state.tShift[startLine];
    let max = state.eMarks[startLine];
    let lastLine = "";

    if (position + openDelimiter.length > max) {
      return false;
    }

    if (state.src.slice(position, position + openDelimiter.length) !== openDelimiter) {
      return false;
    }

    position += openDelimiter.length;
    let firstLine = state.src.slice(position, max);

    if (silent) {
      return true;
    }

    if (firstLine.trim().slice(-closeDelimiter.length) === closeDelimiter) {
      firstLine = firstLine.trim().slice(0, -closeDelimiter.length);
      found = true;
    }

    for (nextLine = startLine; !found;) {
      nextLine += 1;

      if (nextLine >= endLine) {
        break;
      }

      position = state.bMarks[nextLine] + state.tShift[nextLine];
      max = state.eMarks[nextLine];

      if (position < max && state.tShift[nextLine] < state.blkIndent) {
        break;
      }

      if (state.src.slice(position, max).trim().slice(-closeDelimiter.length) === closeDelimiter) {
        lastPosition = state.src.slice(0, max).lastIndexOf(closeDelimiter);
        lastLine = state.src.slice(position, lastPosition);
        found = true;
      }
    }

    state.line = nextLine + 1;

    const token = state.push("math_block", "math", 0);
    token.block = true;
    token.content = (firstLine && firstLine.trim() ? `${firstLine}\n` : "")
      + state.getLines(startLine + 1, nextLine, state.tShift[startLine], true)
      + (lastLine && lastLine.trim() ? lastLine : "");
    token.map = [startLine, state.line];
    token.markup = markup;
    token.meta = { display: true };

    return true;
  };
}

function mathPlugin(md, { tex2svgHtml }) {
  const blockRuleOptions = {
    alt: ["paragraph", "reference", "blockquote", "list"]
  };

  md.inline.ruler.before("escape", "math_inline_bracket", bracketInlineMath);
  md.inline.ruler.after("escape", "math_inline_dollar", dollarInlineMath);
  md.block.ruler.after(
    "blockquote",
    "math_block_bracket",
    createBlockMathRule("\\[", "\\]", "\\["),
    blockRuleOptions
  );
  md.block.ruler.after(
    "math_block_bracket",
    "math_block_dollar",
    createBlockMathRule("$$", "$$", "$$"),
    blockRuleOptions
  );

  md.renderer.rules.math_inline = (tokens, index) => createMathRenderer(tokens[index], tex2svgHtml);
  md.renderer.rules.math_block = (tokens, index) => createMathRenderer(tokens[index], tex2svgHtml);
}

module.exports = {
  mathPlugin
};
