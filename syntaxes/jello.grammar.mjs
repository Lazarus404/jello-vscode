// The Jello TextMate grammar, written with String.raw so the regexps read as regexps.
// `node scripts/build-grammar.mjs` writes it to jello.tmLanguage.json; `npm test` checks the
// two agree, and that the keyword groups below agree with the compiler's lexer.

const r = String.raw;

/** The reserved words, by the scope each takes. Together, exactly the lexer's keywords. */
export const KEYWORDS = {
  "keyword.control.jello": [
    "if",
    "else",
    "while",
    "do",
    "for",
    "break",
    "continue",
    "return",
    "match",
    "when",
    "with",
    "try",
    "catch",
    "throw",
  ],
  "storage.type.jello": ["let", "const", "fn", "enum", "typedef", "prototype", "macro"],
  "keyword.control.import.jello": ["package", "import", "export", "from", "type", "load"],
  "keyword.operator.expression.jello": ["is", "as", "new"],
  "constant.language.jello": ["true", "false", "null"],
  "variable.language.jello": ["this", "super"],
  "keyword.other.reserved.jello": ["await"],
  // A keyword only before `[`; otherwise a name.
  "keyword.other.literal.jello": ["list", "bits"],
};

/** The built-in types, as the checker names them. */
export const TYPES = [
  "I8",
  "I16",
  "I32",
  "I64",
  "U8",
  "U16",
  "U32",
  "U64",
  "F16",
  "F32",
  "F64",
  "Bool",
  "Bytes",
  "Dynamic",
  "Null",
  "Atom",
  "Object",
  "Array",
  "List",
  "Tuple",
  "ByteBuffer",
];

/** The namespaces in scope in every module. */
export const NAMESPACES = [
  "Std",
  "System",
  "Math",
  "Float",
  "Integer",
  "Array",
  "Bytes",
  "List",
  "Object",
  "Tuple",
  "Atom",
  "Enum",
  "Function",
];

const IDENT = r`[_A-Za-z][_A-Za-z0-9]*`;
const words = (list) => list.join("|");
const notLiteral = KEYWORDS["keyword.other.literal.jello"];

const keywordRules = Object.entries(KEYWORDS).map(([name, list]) =>
  list === notLiteral
    ? { name, match: r`\b(?:${words(list)})\b(?=\s*\[)` }
    : { name, match: r`\b(?:${words(list)})\b` },
);

const escapes = (extra) => [
  {
    name: "constant.character.escape.jello",
    match:
      r`\\(?:[0abtnvfr"'` +
      "`" +
      r`\\${extra}]|x[0-9A-Fa-f]{2}|u[0-9A-Fa-f]{4}|u\{[0-9A-Fa-f]{1,6}\})`,
  },
  { name: "invalid.illegal.escape.jello", match: r`\\.?` },
];

export const grammar = {
  $schema: "https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json",
  name: "Jello",
  scopeName: "source.jello",
  fileTypes: ["jello"],
  patterns: [{ include: "#statements" }],
  repository: {
    statements: {
      patterns: [
        { include: "#comments" },
        { include: "#strings" },
        { include: "#regexp" },
        { include: "#atoms" },
        { include: "#numbers" },
        { include: "#modules" },
        { include: "#declarations" },
        { include: "#for-header" },
        { include: "#bits" },
        { include: "#layout" },
        { include: "#abstract" },
        { include: "#macros" },
        { include: "#members" },
        { include: "#keywords" },
        { include: "#types" },
        { include: "#calls" },
        { include: "#operators" },
        { include: "#blocks" },
        { include: "#punctuation" },
        { include: "#names" },
      ],
    },

    comments: {
      patterns: [
        {
          name: "comment.block.documentation.jello",
          begin: r`/\*\*(?![*/])`,
          end: r`\*/`,
          beginCaptures: { 0: { name: "punctuation.definition.comment.begin.jello" } },
          endCaptures: { 0: { name: "punctuation.definition.comment.end.jello" } },
          patterns: [
            {
              match: r`(@(?:param|return|returns|throws|see|note))\b(?:\s+(${IDENT}))?`,
              captures: {
                1: { name: "storage.type.class.doc.jello" },
                2: { name: "variable.parameter.doc.jello" },
              },
            },
            { name: "markup.inline.raw.doc.jello", match: "`[^`\\n]*`" },
          ],
        },
        {
          name: "comment.block.jello",
          begin: r`/\*`,
          end: r`\*/`,
          beginCaptures: { 0: { name: "punctuation.definition.comment.begin.jello" } },
          endCaptures: { 0: { name: "punctuation.definition.comment.end.jello" } },
        },
        {
          name: "comment.line.double-slash.jello",
          begin: "//",
          end: "$",
          beginCaptures: { 0: { name: "punctuation.definition.comment.jello" } },
        },
        {
          name: "comment.line.number-sign.jello",
          begin: "#",
          end: "$",
          beginCaptures: { 0: { name: "punctuation.definition.comment.jello" } },
        },
      ],
    },

    strings: {
      patterns: [
        {
          name: "string.quoted.double.jello",
          begin: '"',
          end: r`(")|$`,
          beginCaptures: { 0: { name: "punctuation.definition.string.begin.jello" } },
          endCaptures: { 1: { name: "punctuation.definition.string.end.jello" } },
          patterns: escapes(""),
        },
        {
          name: "string.quoted.single.jello",
          begin: "'",
          end: r`(')|$`,
          beginCaptures: { 0: { name: "punctuation.definition.string.begin.jello" } },
          endCaptures: { 1: { name: "punctuation.definition.string.end.jello" } },
          patterns: escapes(""),
        },
        {
          name: "string.template.jello",
          begin: "`",
          end: "`",
          beginCaptures: { 0: { name: "punctuation.definition.string.template.begin.jello" } },
          endCaptures: { 0: { name: "punctuation.definition.string.template.end.jello" } },
          patterns: [
            ...escapes(r`$`),
            {
              name: "meta.template.expression.jello",
              contentName: "meta.embedded.line.jello",
              begin: r`\$\{`,
              end: r`\}`,
              beginCaptures: {
                0: { name: "punctuation.definition.template-expression.begin.jello" },
              },
              endCaptures: { 0: { name: "punctuation.definition.template-expression.end.jello" } },
              patterns: [{ include: "#statements" }],
            },
          ],
        },
        {
          // `"A".code`: a one-character literal's code point.
          match: r`(?<=["'])(\.)(code)\b`,
          captures: {
            1: { name: "punctuation.accessor.jello" },
            2: { name: "support.variable.property.code.jello" },
          },
        },
      ],
    },

    regexp: {
      name: "string.regexp.jello",
      begin: r`(~r)(/)`,
      end: r`(/)([imsxU]*)|$`,
      beginCaptures: {
        1: { name: "punctuation.definition.regexp.sigil.jello" },
        2: { name: "punctuation.definition.string.begin.jello" },
      },
      endCaptures: {
        1: { name: "punctuation.definition.string.end.jello" },
        2: { name: "keyword.other.flag.regexp.jello" },
      },
      patterns: [
        { name: "constant.character.escape.regexp.jello", match: r`\\.` },
        { name: "constant.other.character-class.regexp.jello", match: r`\[(?:\\.|[^\]\\/])*\]` },
        { name: "keyword.operator.quantifier.regexp.jello", match: r`[*+?]|\{\d+(?:,\d*)?\}` },
        { name: "keyword.control.anchor.regexp.jello", match: r`[\^$|]` },
      ],
    },

    atoms: {
      // Not after a name, a closing bracket or a quote, so `{a:b}` and `f(a:I32)` stay plain.
      name: "constant.other.symbol.atom.jello",
      match: r`(?<![\w)\]"'` + "`" + r`])(:)${IDENT}`,
      captures: { 1: { name: "punctuation.definition.symbol.jello" } },
    },

    numbers: {
      patterns: [
        {
          name: "constant.numeric.float.jello",
          match: r`(?<![\w.])(?:\d+\.\d+(?:[eE][+-]?\d+)?|\d+[eE][+-]?\d+|\d+\.(?![\w.])|(?<![)\]])\.\d+(?:[eE][+-]?\d+)?)(f16|f32|f64)?(?![\w.])`,
          captures: { 1: { name: "storage.type.numeric.suffix.jello" } },
        },
        {
          name: "constant.numeric.integer.jello",
          match: r`(?<![\w.])(?:0[xX][0-9A-Fa-f_]+|0[bB][01_]+|0[oO][0-7_]+|\d+)([iu](?:8|16|32|64)|f(?:16|32|64))?(?!\w)`,
          captures: { 1: { name: "storage.type.numeric.suffix.jello" } },
        },
      ],
    },

    modules: {
      patterns: [
        {
          match: r`\b(package)\s+(${IDENT}(?:\s*\.\s*${IDENT})*)`,
          captures: {
            1: { name: "keyword.control.import.jello" },
            2: { name: "entity.name.namespace.jello" },
          },
        },
        {
          name: "meta.import.jello",
          begin: r`\b(import|load)\b`,
          beginCaptures: { 1: { name: "keyword.control.import.jello" } },
          end: ";",
          endCaptures: { 0: { name: "punctuation.terminator.statement.jello" } },
          patterns: [
            { include: "#comments" },
            {
              match: r`\b(from)\s+(${IDENT}(?:\s*\.\s*${IDENT})*)`,
              captures: {
                1: { name: "keyword.control.import.jello" },
                2: { name: "entity.name.namespace.jello" },
              },
            },
            {
              match: r`\b(as)\s+(${IDENT})`,
              captures: {
                1: { name: "keyword.control.import.jello" },
                2: { name: "variable.other.alias.jello" },
              },
            },
            { name: "keyword.control.import.jello", match: r`\btype\b` },
            {
              name: "entity.name.namespace.jello",
              match: r`\b${IDENT}(?:\s*\.\s*${IDENT})+`,
            },
            { name: "entity.name.type.jello", match: r`\b[A-Z][_A-Za-z0-9]*\b` },
            { name: "variable.other.readwrite.import.jello", match: IDENT },
            { name: "punctuation.separator.comma.jello", match: "," },
            { name: "punctuation.definition.block.jello", match: r`[{}]` },
          ],
        },
      ],
    },

    declarations: {
      patterns: [
        {
          // A function binding: `let name = fn`, `let name<T> = fn`, `let name: (A) -> B = fn`.
          match: r`\b(?:(export)\s+)?(let|const)\s+(${IDENT})(?=\s*(?:<[^=;]*>)?\s*(?::[^=;]*)?=\s*(?:method\s+)?fn\b)`,
          captures: {
            1: { name: "storage.modifier.export.jello" },
            2: { name: "storage.type.jello" },
            3: { name: "entity.name.function.jello" },
          },
        },
        {
          match: r`\b(?:(export)\s+)?(const)\s+(${IDENT})`,
          captures: {
            1: { name: "storage.modifier.export.jello" },
            2: { name: "storage.type.jello" },
            3: { name: "variable.other.constant.jello" },
          },
        },
        {
          match: r`\b(?:(export)\s+)?(let)\s+(${IDENT})\b`,
          captures: {
            1: { name: "storage.modifier.export.jello" },
            2: { name: "storage.type.jello" },
            3: { name: "variable.other.declaration.jello" },
          },
        },
        {
          name: "meta.enum.jello",
          begin: r`\b(?:(export)\s+)?(enum)\s+(${IDENT})`,
          beginCaptures: {
            1: { name: "storage.modifier.export.jello" },
            2: { name: "storage.type.jello" },
            3: { name: "entity.name.type.enum.jello" },
          },
          end: r`(?<=\})`,
          patterns: [
            { include: "#comments" },
            { include: "#type-parameters" },
            {
              begin: r`\{`,
              end: r`\}`,
              beginCaptures: { 0: { name: "punctuation.definition.block.jello" } },
              endCaptures: { 0: { name: "punctuation.definition.block.jello" } },
              patterns: [
                { include: "#comments" },
                {
                  match: r`(?:(?<=[{;])|^)\s*([A-Z][_A-Za-z0-9]*)\b`,
                  captures: { 1: { name: "variable.other.enummember.jello" } },
                },
                { include: "#statements" },
              ],
            },
          ],
        },
        {
          match: r`\b(?:(export)\s+)?(typedef)\s+(${IDENT})`,
          captures: {
            1: { name: "storage.modifier.export.jello" },
            2: { name: "storage.type.jello" },
            3: { name: "entity.name.type.jello" },
          },
        },
        {
          name: "meta.prototype.jello",
          begin: r`\b(?:(export)\s+)?(prototype)\s+(${IDENT})`,
          beginCaptures: {
            1: { name: "storage.modifier.export.jello" },
            2: { name: "storage.type.jello" },
            3: { name: "entity.name.type.class.jello" },
          },
          end: r`(?<=\})`,
          patterns: [
            { include: "#comments" },
            { include: "#type-parameters" },
            {
              begin: r`\{`,
              end: r`\}`,
              beginCaptures: { 0: { name: "punctuation.definition.block.jello" } },
              endCaptures: { 0: { name: "punctuation.definition.block.jello" } },
              patterns: [
                { include: "#comments" },
                {
                  match: r`(?:(?<=[{;])|^)\s*(${IDENT})\s*(?=\()`,
                  captures: { 1: { name: "entity.name.function.member.jello" } },
                },
                {
                  match: r`(?:(?<=[{;])|^)\s*(${IDENT})\s*(?=:)`,
                  captures: { 1: { name: "variable.other.property.jello" } },
                },
                { include: "#statements" },
              ],
            },
          ],
        },
        {
          match: r`\b(?:(export)\s+)?(macro)\s+(${IDENT})`,
          captures: {
            1: { name: "storage.modifier.export.jello" },
            2: { name: "storage.type.jello" },
            3: { name: "entity.name.function.macro.jello" },
          },
        },
        {
          match: r`\b(method)\s+(fn)\b`,
          captures: {
            1: { name: "storage.modifier.method.jello" },
            2: { name: "storage.type.jello" },
          },
        },
        { name: "storage.modifier.export.jello", match: r`\bexport\b` },
      ],
    },

    "type-parameters": {
      begin: "<",
      end: ">",
      beginCaptures: { 0: { name: "punctuation.definition.typeparameters.begin.jello" } },
      endCaptures: { 0: { name: "punctuation.definition.typeparameters.end.jello" } },
      patterns: [{ include: "#types" }, { include: "#operators" }, { include: "#punctuation" }],
    },

    "for-header": {
      // `for (x in xs)` and `for (i, x in xs)`: `in` is a keyword only here.
      begin: r`\b(for)\s*(\()`,
      end: r`\)`,
      beginCaptures: {
        1: { name: "keyword.control.jello" },
        2: { name: "punctuation.definition.parameters.begin.jello" },
      },
      endCaptures: { 0: { name: "punctuation.definition.parameters.end.jello" } },
      patterns: [
        { name: "keyword.control.in.jello", match: r`\bin\b` },
        { include: "#parens" },
        { include: "#statements" },
      ],
    },

    bits: {
      begin: r`\b(bits)\s*(\[)`,
      end: r`\]`,
      beginCaptures: {
        1: { name: "keyword.other.literal.jello" },
        2: { name: "punctuation.definition.bits.begin.jello" },
      },
      endCaptures: { 0: { name: "punctuation.definition.bits.end.jello" } },
      patterns: [{ include: "#segments" }, { include: "#brackets" }, { include: "#statements" }],
    },

    layout: {
      begin: r`\b(bytes)(-)(layout)\s*(\{)`,
      end: r`\}`,
      beginCaptures: {
        1: { name: "storage.type.layout.jello" },
        3: { name: "storage.type.layout.jello" },
        4: { name: "punctuation.definition.block.jello" },
      },
      endCaptures: { 0: { name: "punctuation.definition.block.jello" } },
      patterns: [{ include: "#segments" }, { include: "#statements" }],
    },

    abstract: {
      match: r`(?<==)\s*\b(abstract)\b(?=\s*;)`,
      captures: { 1: { name: "storage.type.abstract.jello" } },
    },

    segments: {
      patterns: [
        {
          match: r`\b(?:[1-8]|16|32|[uUiI](?:8|16|32|64)|[fF](?:32|64)|rest|bits)\b(?=\s*(?:\.\s*(?:le|be)\b)?\s*[(;,\]])`,
          name: "support.type.segment.jello",
        },
        {
          match: r`(\.)\s*(le|be)\b`,
          captures: {
            1: { name: "punctuation.accessor.jello" },
            2: { name: "storage.modifier.endian.jello" },
          },
        },
      ],
    },

    macros: {
      patterns: [
        {
          match: r`\b(quote)\s*(\.)\s*(expr|stmts|stmt|pat|type)\b`,
          captures: {
            1: { name: "keyword.other.quote.jello" },
            2: { name: "punctuation.accessor.jello" },
            3: { name: "keyword.other.quote.jello" },
          },
        },
        { name: "keyword.other.unquote.jello", match: r`\bunquote\b(?=\s*\()` },
      ],
    },

    members: {
      patterns: [
        {
          // `Shape.Square`: a variant or constant reached through its type.
          match: r`(?<=[\w)\]])(\.)([A-Z][_A-Za-z0-9]*)\b`,
          captures: {
            1: { name: "punctuation.accessor.jello" },
            2: { name: "variable.other.enummember.jello" },
          },
        },
        {
          match: r`(\.)\s*(${IDENT})(?=\s*(?:<[^<>()=;]*>)?\s*\()`,
          captures: {
            1: { name: "punctuation.accessor.jello" },
            2: { name: "entity.name.function.member.jello" },
          },
        },
        {
          match: r`(\.)\s*(${IDENT}|\d+)`,
          captures: {
            1: { name: "punctuation.accessor.jello" },
            2: { name: "variable.other.property.jello" },
          },
        },
      ],
    },

    keywords: { patterns: keywordRules },

    types: {
      patterns: [
        { name: "support.class.namespace.jello", match: r`\b(?:${words(NAMESPACES)})\b(?=\s*\.)` },
        { name: "support.type.primitive.jello", match: r`\b(?:${words(TYPES)})\b` },
        { name: "variable.other.constant.jello", match: r`\b[A-Z][A-Z0-9_]+\b` },
        { name: "entity.name.type.jello", match: r`\b[A-Z][_A-Za-z0-9]*\b` },
      ],
    },

    calls: {
      match: r`\b(${IDENT})(?=\s*(?:<[^<>()=;]*>)?\s*\()`,
      captures: { 1: { name: "entity.name.function.call.jello" } },
    },

    operators: {
      patterns: [
        { name: "keyword.operator.pipeline.jello", match: r`\|>` },
        // The piped value inside a pipeline's body: `xs |> f(%, 1)`.
        { name: "variable.language.pipeline.jello", match: r`%(?=\s*[),.\[\];])` },
        { name: "keyword.operator.coalesce.jello", match: r`\?\?` },
        { name: "keyword.operator.spread.jello", match: r`\.\.\.` },
        { name: "keyword.operator.arrow.jello", match: "->" },
        { name: "punctuation.separator.arrow.jello", match: "=>" },
        { name: "keyword.operator.generator.jello", match: "<-" },
        { name: "keyword.operator.assignment.compound.jello", match: r`<<=|>>=|[+\-*/%&|^]=` },
        { name: "keyword.operator.increment.jello", match: r`\+\+|--` },
        { name: "keyword.operator.comparison.jello", match: r`==|!=|<=|>=` },
        { name: "keyword.operator.logical.jello", match: r`&&|\|\||!` },
        { name: "keyword.operator.bitwise.shift.jello", match: r`<<|>>` },
        // A pin in a pattern, `^name`, binds nothing and compares instead.
        { name: "keyword.operator.pin.jello", match: r`\^(?=[_A-Za-z])` },
        { name: "keyword.operator.assignment.jello", match: "=" },
        { name: "keyword.operator.relational.jello", match: "[<>]" },
        { name: "keyword.operator.arithmetic.jello", match: r`[+\-*/%]` },
        { name: "keyword.operator.bitwise.jello", match: r`[&|^]` },
        { name: "keyword.operator.ternary.jello", match: r`\?` },
      ],
    },

    blocks: {
      begin: r`\{`,
      end: r`\}`,
      beginCaptures: { 0: { name: "punctuation.definition.block.jello" } },
      endCaptures: { 0: { name: "punctuation.definition.block.jello" } },
      patterns: [{ include: "#statements" }],
    },

    parens: {
      begin: r`\(`,
      end: r`\)`,
      beginCaptures: { 0: { name: "punctuation.brace.round.jello" } },
      endCaptures: { 0: { name: "punctuation.brace.round.jello" } },
      patterns: [{ include: "#parens" }, { include: "#statements" }],
    },

    brackets: {
      begin: r`\[`,
      end: r`\]`,
      beginCaptures: { 0: { name: "punctuation.brace.square.jello" } },
      endCaptures: { 0: { name: "punctuation.brace.square.jello" } },
      patterns: [{ include: "#brackets" }, { include: "#statements" }],
    },

    punctuation: {
      patterns: [
        { name: "punctuation.terminator.statement.jello", match: ";" },
        { name: "punctuation.separator.comma.jello", match: "," },
        { name: "punctuation.accessor.jello", match: r`\.` },
        { name: "punctuation.separator.colon.jello", match: ":" },
      ],
    },

    names: {
      patterns: [
        { name: "variable.language.wildcard.jello", match: r`\b_\b` },
        { name: "variable.other.readwrite.jello", match: IDENT },
      ],
    },
  },
};

/** Highlights ```jello fences in Markdown. */
export const markdownInjection = {
  scopeName: "markdown.jello.codeblock",
  injectionSelector: "L:text.html.markdown",
  patterns: [{ include: "#jello-code-block" }],
  repository: {
    "jello-code-block": {
      begin: r`(^|\G)(\s*)(\x60{3,}|~{3,})\s*(jello)\b[^\n]*$`,
      name: "markup.fenced_code.block.markdown",
      end: r`(^|\G)(\2|\s{0,3})(\3)\s*$`,
      beginCaptures: {
        3: { name: "punctuation.definition.markdown" },
        4: { name: "fenced_code.block.language.markdown" },
      },
      endCaptures: { 3: { name: "punctuation.definition.markdown" } },
      patterns: [
        {
          begin: r`(^|\G)(\s*)(.*)`,
          while: r`(^|\G)(?!\s*([\x60~]{3,})\s*$)`,
          contentName: "meta.embedded.block.jello",
          patterns: [{ include: "source.jello" }],
        },
      ],
    },
  },
};
