// oxlint plugin: low-quality AI-generated comments. Warn-only.
// See https://oxc.rs/docs/guide/usage/linter/writing-js-plugins

// ── Shared helpers ──

/**
 * Directives and keeper patterns that must never be flagged, regardless
 * of what the rest of the comment text looks like.
 */
const KEEPER_RE =
  /(?:^|\s)(?:TODO|FIXME|HACK|BUG|NOTE|SAFETY|PERF|IMPORTANT|XXX|LICENSE|COPYRIGHT|eslint-disable|eslint-enable|@ts-ignore|@ts-expect-error|@ts-nocheck|@ts-check|@type|@param|@returns?|@throws|@see|@example|@deprecated|@override|@internal|@public|@private|@protected|@readonly|@satisfies|istanbul\s+ignore|c8\s+ignore|vitest)/i;

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
          if (comment.type === "Block") continue;
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
          // Skip line comments that are keeper directives
          if (KEEPER_RE.test(comment.value)) continue;
          // Skip JSDoc / block comments (they often cite examples)
          if (comment.type === "Block") continue;
          const text = commentText(comment);
          if (HEDGING_RE.test(text)) {
            context.report({ node: comment, messageId: "noHedgingComment" });
          }
        }
      },
    };
  },
};

/** @type {import('eslint').ESLint.Plugin} */
export default {
  meta: { name: "comment-quality" },
  rules: {
    "no-narrator-comment": noNarratorComment,
    "no-section-divider": noSectionDivider,
    "no-placeholder-comment": noPlaceholderComment,
    "no-hedging-comment": noHedgingComment,
  },
};
