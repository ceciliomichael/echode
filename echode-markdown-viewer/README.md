# EchoDE Markdown Viewer

The focused Markdown viewer extracted from EchoDE Coder. It keeps EchoDE's comfortable document layout and Mermaid support without installing the AI assistant or any model/provider dependencies.

## Features

- GitHub Flavored Markdown, including tables, strikethrough, autolinks, and task lists
- Mermaid diagrams rendered inline with VS Code light and dark theme colors
- Syntax-highlighted code blocks with line numbers and copy feedback
- Live preview updates while the source document changes
- One reusable preview tab per Markdown file
- Working heading anchors, relative Markdown links, local images, web links, and file links
- Preview restoration after a VS Code window reload
- Desktop and compact mobile/web layouts

## Use

Open a `.md` or `.markdown` file, then use one of these actions:

- Press `Ctrl+Shift+V` on Windows/Linux or `Cmd+Shift+V` on macOS.
- Run **EchoDE Markdown Viewer: Open Markdown Preview** from the Command Palette.
- Select the preview icon in the editor title to open the preview beside the source.
- Right-click a Markdown file in the Explorer and select **Open Markdown Preview**.

## Install the packaged extension

In VS Code, open the Command Palette, choose **Extensions: Install from VSIX...**, and select `echode-markdown-viewer.vsix`.

From a terminal, you can also run:

```sh
code --install-extension echode-markdown-viewer.vsix
```

## Build from source

```sh
npm install
npm run build
npm run package:vsix
```

The VSIX is written to the repository's `builds` directory.

## Security

Markdown HTML is not executed. Mermaid uses strict security mode, webview content is protected by a Content Security Policy, and links are opened by VS Code after protocol and path handling in the extension host.
