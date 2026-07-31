// oxlint plugin: low-quality AI-generated comments. Warn-only.
// See https://oxc.rs/docs/guide/usage/linter/writing-js-plugins

// ── Shared helpers ──

/** @typedef {import('./oxlint-plugin.js').OxlintRule} OxlintRule */

/**
 * Directives and keeper patterns that must never be flagged, regardless
 * of what the rest of the comment text looks like.
 */
const KEEPER_RE =
  /(?:^|\s)(?:TODO|FIXME|HACK|BUG|NOTE|SAFETY|PERF|IMPORTANT|XXX|LICENSE|COPYRIGHT|oxlint-disable|oxlint-enable|eslint-disable|eslint-enable|@ts-ignore|@ts-expect-error|@ts-nocheck|@ts-check|@type|@param|@returns?|@throws|@see|@example|@deprecated|@override|@internal|@public|@private|@protected|@readonly|@satisfies|istanbul\s+ignore|c8\s+ignore|vitest)/i;

/**
 * Words that signal a comment is explaining *why*, not *what*.
 * If any of these appear, the comment is likely valuable.
 */
const EXPLAINS_WHY_RE =
  /\b(?:because|since|so\s+that|in\s+order\s+to|otherwise|workaround|intentional(?:ly)?|deliberate(?:ly)?|required\s+by|needed\s+(?:for|because|by|to)|must\s+be|cannot|can't|won't|shouldn't|NB|caveat|edge\s+case|race\s+condition|perf|optimization|compat(?:ibility)?|legacy|regression|upstream|downstream|spec\s+(?:says|requires)|RFC|per\s+(?:the\s+)?(?:spec|docs?|standard))\b/i;

/**
 * Returns the trimmed text of a comment node, collapsing whitespace.
 */
function commentText(node) {
  return node.value
    .replace(/^\s*\*\s?/gm, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Rules ──

/**
 * Flags preamble comments like "This function/method/class handles..."
 * that just narrate the declaration without adding insight.
 *
 * Uses a focused regex: requires "This <thing> <verb>" structure.
 */
const NARRATOR_RE =
  /^\s*this\s+(?:function|method|class|component|hook|module|handler|helper|utility|service|controller|provider|manager|resolver|wrapper|plugin|factory)\s+(?:is\s+(?:responsible\s+for|used\s+(?:to|for))|(?:will|should|can)\s+(?:handle|create|process|manage|return|generate|provide)|handles|creates|initializes|processes|manages|controls|provides|returns|generates|validates|renders|transforms|computes)/i;

/** @type {OxlintRule} */
const noNarratorComment = {
  meta: {
    type: "suggestion",
    docs: {
      description: 'Disallow "This function/method handles..." preamble comments',
    },
    messages: {
      noNarratorComment: 'Narrating comment ("This function handles..."). Remove it or explain the *why*.',
    },
    schema: [],
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          // Block comments are inspected too: a doc-block is exactly where a
          // narrator preamble gets written. KEEPER_RE exempts the tagged forms.
          if (KEEPER_RE.test(comment.value)) continue;
          const text = commentText(comment);
          if (EXPLAINS_WHY_RE.test(text)) continue;
          if (NARRATOR_RE.test(text)) {
            context.report({ node: comment, messageId: "noNarratorComment" });
          }
        }
      },
    };
  },
};

/**
 * Flags decorative section-divider comments made of repeated symbols
 * or labelled banners like `// --- Helpers ---`.
 */
const SECTION_DIVIDER_RE = /^\s*[-=*#~_/\\]{3,}\s*(?:\w[\w\s]*\s*[-=*#~_/\\]*)?$/;

/** @type {OxlintRule} */
const noSectionDivider = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow decorative section-divider comments",
    },
    messages: {
      noSectionDivider: "Decorative divider comment. Use code structure (modules, functions) to organize instead.",
    },
    schema: [],
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (KEEPER_RE.test(comment.value)) continue;
          const text = commentText(comment);
          if (text.length < 4) continue;
          if (SECTION_DIVIDER_RE.test(text)) {
            context.report({ node: comment, messageId: "noSectionDivider" });
          }
        }
      },
    };
  },
};

/**
 * Flags placeholder comments indicating incomplete or omitted code.
 */
const PLACEHOLDER_RE =
  /(?:\.{3}\s*(?:rest|more|other|remaining|additional)|omitted\s+for\s+brevity|replace\s+(?:this|the\s+above)\s+with|your\s+(?:actual|real)\s+(?:implementation|code|logic)|add\s+(?:your|the\s+rest)\s+(?:implementation|code|logic)|implement\s+(?:this|here)|not\s+yet\s+implemented)/i;

/** @type {OxlintRule} */
const noPlaceholderComment = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow placeholder comments indicating incomplete code",
    },
    messages: {
      noPlaceholderComment: "Placeholder comment suggests incomplete code. Implement or remove.",
    },
    schema: [],
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (KEEPER_RE.test(comment.value)) continue;
          const text = commentText(comment);
          if (PLACEHOLDER_RE.test(text)) {
            context.report({ node: comment, messageId: "noPlaceholderComment" });
          }
        }
      },
    };
  },
};

/**
 * Flags hedging language that signals low-confidence AI generation.
 * Only matches unambiguously uncertain phrases; "should work" is excluded
 * since it commonly means "is expected to work" in test comments.
 */
const HEDGING_RE =
  /(?:hopefully|probably\s+(?:fine|works?|correct|ok|okay)|not\s+sure\s+(?:if|why|whether|about)|i\s+think\s+this|good\s+enough\s+for\s+now|fix\s+(?:this\s+)?later|quick\s+(?:hack|fix|workaround)|temporary\s+(?:fix|hack|workaround|solution))/i;

/** @type {OxlintRule} */
const noHedgingComment = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow hedging language in comments that signals uncertainty",
    },
    messages: {
      noHedgingComment: "Comment contains hedging language. Verify the code works and rewrite or remove the comment.",
    },
    schema: [],
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          // Keeper directives are exempt; doc-blocks are not, since a hedge
          // reads the same whether it is written above the symbol or inside it.
          if (KEEPER_RE.test(comment.value)) continue;
          const text = commentText(comment);
          if (HEDGING_RE.test(text)) {
            context.report({ node: comment, messageId: "noHedgingComment" });
          }
        }
      },
    };
  },
};

/**
 * Flags comments that narrate the edit rather than state the current contract.
 *
 * Deliberately narrow: only phrases that cannot describe anything but a change
 * to the code. Broader wording ("this change", "extracted from", "was
 * previously") carries legitimate domain meanings here, such as a change event
 * or a type derived from a signature. A comment that also explains a why is
 * exempt, because history that justifies a live constraint is worth keeping.
 */
const EDIT_NARRATION_RE =
  /\b(?:renamed\s+from|moved\s+(?:here|it)\s+for\s+clarity|moved\s+(?:outside|out\s+of)\s+this\s+(?:ruleset|block|file)|as\s+of\s+#\d+|in\s+this\s+(?:PR|commit|patch)|this\s+(?:commit|PR)|previously\s+(?:called|named|lived)|used\s+to\s+live|replaces?\s+the\s+old|collapsed\s+from|split\s+out\s+from|no\s+longer\s+(?:called|named))\b/i;

/** @type {OxlintRule} */
const noEditNarration = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow comments that narrate the edit instead of the current contract",
    },
    messages: {
      noEditNarration:
        "Comment narrates the edit, not the contract. State what the code does now; the history belongs in the commit message.",
    },
    schema: [],
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (KEEPER_RE.test(comment.value)) continue;
          const text = commentText(comment);
          if (EXPLAINS_WHY_RE.test(text)) continue;
          if (EDIT_NARRATION_RE.test(text)) {
            context.report({ node: comment, messageId: "noEditNarration" });
          }
        }
      },
    };
  },
};

/**
 * Flags issue pointers and known-limitation notes left in code.
 *
 * Unlike its siblings this skips only tooling directives, not `TODO` / `FIXME`,
 * since a ticket pointer behind a TODO is the very pattern being caught.
 */
const TOOLING_DIRECTIVE_RE =
  /(?:eslint-disable|eslint-enable|oxlint-disable|@ts-ignore|@ts-expect-error|@ts-nocheck|istanbul\s+ignore|c8\s+ignore)/i;

const ISSUE_REFERENCE_RE =
  /(?:tracked\s+in\s+#\d+|\bsee\s+#\d+|known\s+limitation|fixed\s+in\s+#\d+|follow-?up\s+in\s+#\d+|addressed\s+in\s+#\d+)/i;

/** @type {OxlintRule} */
const noIssueReferenceComment = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow issue-tracker pointers and known-limitation notes in comments",
    },
    messages: {
      noIssueReferenceComment:
        "Issue pointer in code. Fix it here, or record the limitation in the issue; a comment pointing at a ticket rots once the ticket closes.",
    },
    schema: [],
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (TOOLING_DIRECTIVE_RE.test(comment.value)) continue;
          if (ISSUE_REFERENCE_RE.test(commentText(comment))) {
            context.report({ node: comment, messageId: "noIssueReferenceComment" });
          }
        }
      },
    };
  },
};

/**
 * Grammatical glue that carries no information about the code below.
 */
const FUNCTION_WORD_RE =
  /^(?:a|an|and|any|are|as|at|be|by|for|from|here|if|in|into|is|it|its|of|on|or|our|that|the|their|then|this|to|we|when|which|will|with)$/;

/**
 * Verbs the code shape already states, so they add nothing when a comment
 * repeats them: an assignment is a "set", a member read is a "get".
 */
const CODE_SHAPE_VERB_RE =
  /^(?:add|assign|build|calculate|call|check|compute|create|declare|decrement|define|delete|fetch|find|get|increment|init|initialize|instantiate|invoke|iterate|look|lookup|loop|make|new|read|remove|return|save|set|store|update|write)$/;

/** Statements plain enough that a comment naming their words is a restatement. */
const RESTATEABLE_STATEMENTS = new Set(["VariableDeclaration", "ExpressionStatement", "ReturnStatement"]);

/**
 * Words that count as restatement candidates: prose, not literal debris.
 * A fragment carrying digits (`F9`, `AC00`) names a value, not a description,
 * so its presence on both sides is no evidence that the comment repeats the code.
 */
const PROSE_WORD_RE = /^[a-z]{2,}$/;

/** Tokens that spell out what the statement says; literals carry data, not description. */
const NAMING_TOKENS = new Set(["Identifier", "Keyword", "PrivateIdentifier"]);

/** A comment longer than this carries prose, not a label. */
const MAX_COMMENT_WORDS = 10;

/**
 * Splits text into lowercase word stems: separators and camelCase boundaries
 * both break, and a trailing plural `s` is dropped so `keys` matches `key`.
 */
function wordStems(text) {
  return text
    .split(/[^A-Za-z0-9]+/)
    .flatMap((word) => word.split(/(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/))
    .filter(Boolean)
    .map((word) => word.toLowerCase())
    .map((word) => (word.length > 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word));
}

/**
 * Returns the plain statement that starts on the line directly under `comment`,
 * or null when the comment does not sit on top of one.
 *
 * A statement spanning more than one line is rejected. Its token list covers every
 * nested line - the body of an `it(...)` call, say - so a comment naming words that
 * appear anywhere inside it is no evidence that it restates the line below.
 */
function statementBelow(sourceCode, comment) {
  const nextLine = sourceCode.lines[comment.loc.end.line];
  if (nextLine === undefined) return null;
  const indent = nextLine.search(/\S/);
  if (indent === -1) return null;
  let node = sourceCode.getNodeByRangeIndex(
    sourceCode.getIndexFromLoc({ line: comment.loc.end.line + 1, column: indent }),
  );
  // `Program` starts at its first token, so a leading comment leaves it sharing
  // the start offset of the statement below; climbing into it loses the statement.
  while (node?.parent && node.parent.type !== "Program" && node.parent.start === node.start) node = node.parent;
  if (!node || !RESTATEABLE_STATEMENTS.has(node.type)) return null;
  return sourceCode.getLocFromIndex(node.start).line === sourceCode.getLocFromIndex(node.end).line ? node : null;
}

/**
 * Flags a comment whose every word is already spelled out by the statement it
 * sits on: `// Get the user name` above `const name = user.name;`.
 *
 * Line comments only. A doc-block restating its symbol is the JSDoc contract
 * this repo asks for ("Returns the memoized Map view of `source`."), and the
 * narrating preamble form is already covered by `no-narrator-comment`.
 *
 * @type {OxlintRule}
 */
const noObviousComment = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow comments that only restate the statement below them",
    },
    messages: {
      noObviousComment: "Comment restates the code below it. Delete it, or say why the code is written this way.",
    },
    schema: [],
  },
  create(context) {
    const { sourceCode } = context;
    return {
      Program() {
        for (const comment of sourceCode.getAllComments()) {
          if (comment.type !== "Line") continue;
          if (KEEPER_RE.test(comment.value)) continue;
          const text = commentText(comment);
          if (EXPLAINS_WHY_RE.test(text)) continue;
          const words = wordStems(text);
          if (words.length > MAX_COMMENT_WORDS) continue;
          const content = words.filter(
            (word) => PROSE_WORD_RE.test(word) && !FUNCTION_WORD_RE.test(word) && !CODE_SHAPE_VERB_RE.test(word),
          );
          if (content.length < 2) continue;
          const ownLine = sourceCode.lines[comment.loc.start.line - 1];
          if (ownLine === undefined || ownLine.slice(0, comment.loc.start.column).trim() !== "") continue;
          const statement = statementBelow(sourceCode, comment);
          if (!statement) continue;
          const codeWords = new Set(
            sourceCode
              .getTokens(statement)
              .filter((token) => NAMING_TOKENS.has(token.type))
              .flatMap((token) => wordStems(token.value)),
          );
          if (content.every((word) => codeWords.has(word))) {
            context.report({ node: comment, messageId: "noObviousComment" });
          }
        }
      },
    };
  },
};

/** @type {import('./oxlint-plugin.js').OxlintPlugin} */
export default {
  meta: { name: "comment-quality" },
  rules: {
    "no-narrator-comment": noNarratorComment,
    "no-section-divider": noSectionDivider,
    "no-placeholder-comment": noPlaceholderComment,
    "no-hedging-comment": noHedgingComment,
    "no-edit-narration": noEditNarration,
    "no-issue-reference-comment": noIssueReferenceComment,
    "no-obvious-comment": noObviousComment,
  },
};
