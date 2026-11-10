# Publishing HumanLeg packages

Publishing is intentionally manual and uses the GitHub Actions workflow `.github/workflows/publish.yml`.

## npm bootstrap

The first npm release needs a short-lived granular access token because trusted publishers are configured from each package's settings after the package exists.

1. Sign in to npm with two-factor authentication enabled.
2. Create the free public organization named `humanleg` if the `@humanleg` scope is not already owned by the project.
3. Create a granular access token with:
   - package/scope access: `@humanleg`
   - permission: **Read and write (publish and stage)**
   - **Bypass two-factor authentication** enabled for this one bootstrap release
   - the shortest practical expiry
4. Add it to GitHub repository secrets as `NPM_TOKEN`. Never commit or paste it into issues, chat, or logs.
5. Run the `publish` workflow once.
6. For each published package, configure npm Trusted Publishing with:
   - provider: GitHub Actions
   - organization/user: `humanleg-ai`
   - repository: `humanleg`
   - workflow filename: `publish.yml`
   - environment: `npm`
   - allow direct `npm publish`
7. Delete the GitHub `NPM_TOKEN` secret and revoke the npm token after OIDC publishing is verified.
8. Set package publishing access to require 2FA and disallow traditional tokens.

## PyPI pending trusted publisher

No PyPI token is needed.

Under the PyPI account sidebar, open **Publishing** and add a pending GitHub publisher:

- PyPI project name: `humanleg`
- GitHub owner: `humanleg-ai`
- repository: `humanleg`
- workflow filename: `publish.yml`
- environment: `pypi`

The pending publisher does not reserve the project name. Run the GitHub workflow soon after creating it. The first successful upload creates the PyPI project and converts the pending publisher into a normal trusted publisher.

## Release run

1. Confirm the intended versions in all package manifests.
2. Confirm the tag points at the reviewed commit.
3. Open GitHub **Actions → publish → Run workflow**.
4. Enter `publish` in the confirmation field.
5. Select npm and/or PyPI.
6. Verify the packages from clean environments before publishing the MCP Registry entry.

## Official MCP Registry

After `@humanleg/mcp-server` is publicly installable, rerun the same workflow with only **MCP Registry** selected. The job:

1. waits for npm propagation;
2. downloads the pinned official `mcp-publisher` release;
3. verifies its Sigstore bundle;
4. validates `server.json`;
5. authenticates with GitHub Actions OIDC; and
6. publishes `io.github.humanleg-ai/humanleg` without a long-lived registry secret.
