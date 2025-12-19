# Offline Installation & Build Guide

This guide describes how to build and install Echode in environments without internet access.

## Prerequisites

Ensure your environment has the following installed:

- VS Code (v1.85.0 or higher)
- Node.js (LTS version recommended, v18+)
- Git (Optional, for transferring source code)

## Strategy A: Build Online, Install Offline (Recommended)

This is the most reliable method. You build the .vsix extension package on a machine with internet access, then transfer the single file to the offline machine.

### 1. Build the Extension (Online Machine)

Clone the repository:
```bash
git clone https://github.com/ceciliomichael/echode.git
cd echode
```

Install dependencies and build:
```bash
# Install root dependencies
npm install

# Install and build frontend
cd webview-ui
npm install
cd ..

# Package the extension
npm run package:vsix
```

This will generate a file named `echode-1.0.x.vsix` in the `builds/` directory.

### 2. Install (Offline Machine)

1. Transfer the `echode.vsix` file to the offline machine.
2. Open VS Code.
3. Open the Extensions view.
4. Click the "..." (Views and More actions) menu at the top-right of the Extensions view.
5. Select "Install from VSIX...".
6. Select the transferred file.

## Strategy B: Build Offline

Use this method only if you need to modify the source code within the offline environment.

**Note on Compatibility:** The online and offline machines must share the same operating system architecture (e.g., both Windows x64). This is required because `better-sqlite3` compiles native binaries specific to the OS.

### 1. Prepare Source (Online Machine)

Clone the repository and install all dependencies to generate the `node_modules` folders:

```bash
git clone https://github.com/ceciliomichael/echode.git
cd echode
npm install
cd webview-ui
npm install
cd ..
```

Compress the entire `echode` directory into a zip or tar file. Ensure both the root `node_modules` and `webview-ui/node_modules` are included.

### 2. Build (Offline Machine)

1. Transfer and extract the archive on the offline machine.
2. Open a terminal in the extracted folder.
3. Run the build script:

```bash
# Using the provided shell script (Linux/macOS)
./build.sh

# Or manually:
cd webview-ui
npm run build
cd ..
npm run package:vsix
```

## Troubleshooting

**Module not found errors:**
Ensure you copied both `node_modules` folders (root and `webview-ui`) when using Strategy B.

**better-sqlite3 errors:**
This dependency relies on native C++ bindings. If the offline machine cannot run the binaries compiled on the online machine (due to OS differences) or cannot compile them itself (missing build tools), the build will fail. In this case, use Strategy A.