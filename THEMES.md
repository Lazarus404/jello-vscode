# Theme Customization for Jello

This document explains how Jello syntax highlighting works with VSCode themes and how to customize colors for Jello-specific tokens.

## How Themes Work

The Jello extension uses standard TextMate scope names that are compatible with all VSCode themes. Different themes will color Jello code differently based on their color scheme.

## Recommended Themes

Jello syntax looks great with these popular themes:

### Dark Themes

- **One Dark Pro** - Excellent contrast, clear distinction between keywords and identifiers
- **Dracula Official** - Vibrant colors, great for atoms and strings
- **Material Theme** - Clean and modern, good for long coding sessions
- **Night Owl** - Optimized for night time, easy on the eyes
- **Monokai Pro** - Classic theme with good color balance

### Light Themes

- **Light+** (Default) - Clean and professional
- **Solarized Light** - Easy on the eyes, good contrast
- **Atom One Light** - Bright and clear
- **GitHub Light** - Familiar GitHub-style colors

## Scope Mappings

The Jello extension uses these TextMate scopes:

| Language Element               | Scope                             | Typical Color  |
| ------------------------------ | --------------------------------- | -------------- |
| Keywords (`if`, `while`, `fn`) | `keyword.control.jello`           | Purple/Magenta |
| Operators (`+`, `->`, `\|>`)   | `keyword.operator.*.jello`        | White/Gray     |
| Numbers                        | `constant.numeric.*.jello`        | Orange/Yellow  |
| Strings                        | `string.quoted.*.jello`           | Green/Yellow   |
| Atoms (`:ok`, `:error`)        | `constant.other.symbol.jello`     | Cyan/Blue      |
| Comments                       | `comment.line.double-slash.jello` | Gray/Green     |
| Functions                      | `entity.name.function.jello`      | Yellow/Blue    |
| Built-in Types                 | `support.type.jello`              | Cyan/Blue      |
| Built-in Namespaces            | `support.class.jello`             | Cyan/Blue      |
| Constants (`null`, `true`)     | `constant.language.jello`         | Orange/Red     |
| `this` keyword                 | `variable.language.jello`         | Purple/Red     |

## Custom Color Customization

You can customize colors for Jello tokens in your VSCode settings.

### Method 1: Settings UI

1. Open Settings (`Cmd+,` or `Ctrl+,`)
2. Search for "Token Color Customizations"
3. Click "Edit in settings.json"
4. Add your customizations

### Method 2: Direct settings.json Edit

Add to your `settings.json`:

```json
{
  "editor.tokenColorCustomizations": {
    "textMateRules": [
      {
        "scope": "constant.other.symbol.jello",
        "settings": {
          "foreground": "#00D9FF",
          "fontStyle": "bold"
        }
      },
      {
        "scope": "keyword.control.jello",
        "settings": {
          "foreground": "#FF79C6",
          "fontStyle": "italic"
        }
      },
      {
        "scope": "support.class.jello",
        "settings": {
          "foreground": "#8BE9FD",
          "fontStyle": "bold"
        }
      }
    ]
  }
}
```

## Example Customizations

### Highlight Atoms Prominently

Make atoms (`:ok`, `:error`) stand out:

```json
{
  "editor.tokenColorCustomizations": {
    "textMateRules": [
      {
        "scope": "constant.other.symbol.jello",
        "settings": {
          "foreground": "#FF6B6B",
          "fontStyle": "bold"
        }
      }
    ]
  }
}
```

### Emphasize Actor Keywords

Make actor-related code more visible:

```json
{
  "editor.tokenColorCustomizations": {
    "textMateRules": [
      {
        "scope": "support.class.jello",
        "settings": {
          "foreground": "#00D9FF",
          "fontStyle": "bold"
        }
      }
    ]
  }
}
```

### Distinctive Function Definitions

Make function definitions stand out:

```json
{
  "editor.tokenColorCustomizations": {
    "textMateRules": [
      {
        "scope": "keyword.other.jello",
        "settings": {
          "foreground": "#FFB86C",
          "fontStyle": "italic bold"
        }
      }
    ]
  }
}
```

### Custom Bitstring Colors

Highlight bitstrings distinctly:

```json
{
  "editor.tokenColorCustomizations": {
    "textMateRules": [
      {
        "scope": "string.other.bitstring.jello",
        "settings": {
          "foreground": "#BD93F9",
          "fontStyle": "italic"
        }
      }
    ]
  }
}
```

## Theme-Specific Customizations

You can apply different colors for different themes:

```json
{
  "editor.tokenColorCustomizations": {
    "[One Dark Pro]": {
      "textMateRules": [
        {
          "scope": "constant.other.symbol.jello",
          "settings": {
            "foreground": "#61AFEF"
          }
        }
      ]
    },
    "[Dracula]": {
      "textMateRules": [
        {
          "scope": "constant.other.symbol.jello",
          "settings": {
            "foreground": "#FF79C6"
          }
        }
      ]
    }
  }
}
```

## Semantic Highlighting

For future versions with Language Server support, semantic highlighting will provide even more precise token coloring based on semantic analysis (not just syntax patterns).

To enable semantic highlighting when available:

```json
{
  "editor.semanticHighlighting.enabled": true
}
```

## Testing Your Customizations

1. Open `test-syntax.jello` in VSCode
2. Make changes to your `settings.json`
3. Save the settings file
4. Colors should update immediately
5. Adjust until you're satisfied

## Color Picker

Use VSCode's built-in color picker:

1. In `settings.json`, hover over a color hex code
2. Click the color square that appears
3. Use the picker to choose a new color
4. Press Enter to apply

## Scope Inspector

To see what scopes are applied to specific tokens:

1. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Run: "Developer: Inspect Editor Tokens and Scopes"
3. Click on any token in your code
4. See the scope hierarchy and current colors

This is useful for:

- Understanding why a token has a certain color
- Finding the right scope to customize
- Debugging theme issues

## Font Styles

Available font styles:

- `"fontStyle": "bold"` - Bold text
- `"fontStyle": "italic"` - Italic text
- `"fontStyle": "bold italic"` - Both bold and italic
- `"fontStyle": ""` - Normal (remove styling)

## Color Format

Colors can be specified as:

- Hex: `"#FF0000"` or `"#F00"`
- RGB: `"rgb(255, 0, 0)"`
- RGBA: `"rgba(255, 0, 0, 0.5)"`

## Example: Complete Jello Theme

Here's a complete custom color scheme for Jello:

```json
{
  "editor.tokenColorCustomizations": {
    "textMateRules": [
      {
        "scope": "keyword.control.jello",
        "settings": {
          "foreground": "#FF79C6",
          "fontStyle": "italic"
        }
      },
      {
        "scope": "keyword.other.jello",
        "settings": {
          "foreground": "#FFB86C",
          "fontStyle": "bold"
        }
      },
      {
        "scope": "constant.other.symbol.jello",
        "settings": {
          "foreground": "#00D9FF",
          "fontStyle": "bold"
        }
      },
      {
        "scope": "constant.language.jello",
        "settings": {
          "foreground": "#FF5555"
        }
      },
      {
        "scope": "constant.numeric.jello",
        "settings": {
          "foreground": "#F1FA8C"
        }
      },
      {
        "scope": "string.quoted.jello",
        "settings": {
          "foreground": "#50FA7B"
        }
      },
      {
        "scope": "comment.line.jello",
        "settings": {
          "foreground": "#6272A4",
          "fontStyle": "italic"
        }
      },
      {
        "scope": "entity.name.function.jello",
        "settings": {
          "foreground": "#8BE9FD"
        }
      },
      {
        "scope": "support.class.jello",
        "settings": {
          "foreground": "#8BE9FD",
          "fontStyle": "bold"
        }
      },
      {
        "scope": "support.type.jello",
        "settings": {
          "foreground": "#8BE9FD"
        }
      },
      {
        "scope": "variable.language.jello",
        "settings": {
          "foreground": "#FF79C6",
          "fontStyle": "italic"
        }
      },
      {
        "scope": "keyword.operator.arrow.jello",
        "settings": {
          "foreground": "#FF79C6"
        }
      },
      {
        "scope": "keyword.operator.pipe.jello",
        "settings": {
          "foreground": "#FF79C6"
        }
      },
      {
        "scope": "string.other.bitstring.jello",
        "settings": {
          "foreground": "#BD93F9",
          "fontStyle": "italic"
        }
      }
    ]
  }
}
```

This creates a Dracula-inspired color scheme optimized for Jello.

## Sharing Your Theme

If you create a great color scheme for Jello:

1. Save your `textMateRules` configuration
2. Share it in a GitHub Gist
3. Post it in the Jello community
4. Consider creating a full VSCode theme extension

## Resources

- [VSCode Theme Color Reference](https://code.visualstudio.com/api/references/theme-color)
- [TextMate Scope Naming](https://www.sublimetext.com/docs/scope_naming.html)
- [VSCode Theme Guide](https://code.visualstudio.com/api/extension-guides/color-theme)
- [Color Picker Tools](https://colorhunt.co/) - Find color palettes

## Tips

1. **Start with a base theme** you like, then customize specific Jello tokens
2. **Use consistent colors** for related concepts (e.g., all built-ins in cyan)
3. **Test in different lighting** conditions
4. **Consider accessibility** - ensure sufficient contrast
5. **Don't overuse bold/italic** - use sparingly for emphasis
6. **Preview with real code** - use test-syntax.jello to see all features

## Troubleshooting

### Colors not updating

- Save your settings.json file
- Reload VSCode window
- Check for syntax errors in JSON

### Wrong colors applied

- Use Scope Inspector to verify scopes
- Check scope specificity (more specific scopes override general ones)
- Ensure theme name matches exactly (case-sensitive)

### Theme not working with Jello

- All standard VSCode themes should work
- If a theme doesn't color Jello well, use custom token colors
- Report issues with specific themes

---

Enjoy customizing your Jello coding experience!
