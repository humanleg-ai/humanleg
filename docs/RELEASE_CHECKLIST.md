# Release checklist

## Source and safety

- [ ] Public/private boundary reviewed against `OPEN_SOURCE_BOUNDARY.md`.
- [ ] Secret scan passes with no findings.
- [ ] Production dependency audit reports no high-severity vulnerabilities.
- [ ] Production dependency license metadata check passes.
- [ ] OpenAPI contains only public `/v1/*` and `/health` routes.
- [ ] Sandbox uses synthetic data and money only.
- [ ] MCP settlement tools remain disabled by default.

## Verification

- [ ] `npm ci`
- [ ] `npm run check`
- [ ] `python -m unittest discover -s python/tests -v`
- [ ] Python wheel installs and imports in a clean virtual environment.
- [ ] `server.json` validates against the official MCP Registry schema.
- [ ] README quickstart works from a clean checkout.

## Publishing order

1. Create the public GitHub repository and enable Discussions, security advisories, and branch protection.
2. Publish `@humanleg/sdk`, `@humanleg/sandbox`, and `@humanleg/mcp-server` to npm with provenance.
3. Publish `humanleg` to PyPI using trusted publishing.
4. Add the GitHub repository ID to `server.json`, validate, then publish to the official MCP Registry.
5. Create the signed GitHub release and attach checksums and the release evidence summary.
6. Announce only after every public install path has been tested from a clean environment.
