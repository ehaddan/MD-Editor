# Publishing to the Visual Studio Marketplace

## Before the first release

1. Sign in at <https://marketplace.visualstudio.com/manage>.
2. Create a publisher. Its identifier must exactly match the `publisher` value
   in `package.json`, currently `eric-haddan`. Publisher IDs cannot be changed
   after creation. If that ID is unavailable, update `package.json` before
   packaging.
3. Create an Azure DevOps Personal Access Token with the **Marketplace >
   Manage** scope.
4. Keep the token private. Never commit it to this repository.

## Verify and package

```powershell
npm install
npm run compile
npm run package
```

This produces a versioned VSIX such as
`eric-haddan-markdown-editor-0.2.0.vsix`.

Install the VSIX locally for a final test:

```powershell
code --install-extension .\eric-haddan-markdown-editor-0.2.0.vsix
```

## Publish

Authenticate once:

```powershell
npx vsce login eric-haddan
```

Publish the version declared in `package.json`:

```powershell
npm run publish
```

Alternatively, upload the newly generated `.vsix` file from the
publisher management page by selecting **New extension > Visual Studio Code**.

For later releases, update `CHANGELOG.md` and increment the version first:

```powershell
npx vsce publish patch
```

Use `minor` or `major` instead of `patch` when appropriate.

## Marketplace listing checklist

- Confirm the publisher identifier in `package.json`.
- Test the packaged VSIX in a normal VS Code window.
- Review `README.md`, `CHANGELOG.md`, `LICENSE.txt`, and `PRIVACY.md`.
- Add a public repository URL to `package.json` before publishing if the source
  will be hosted publicly.
- Keep the Marketplace Personal Access Token private.
- For automated publishing, prefer Microsoft Entra ID authentication instead
  of storing a long-lived Personal Access Token.
