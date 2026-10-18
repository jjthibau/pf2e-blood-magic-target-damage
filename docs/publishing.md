# Publishing

The direct GitHub manifest works independently of Foundry's directory:

```text
https://github.com/jjthibau/pf2e-blood-magic-target-damage/releases/latest/download/module.json
```

For updates, change `module.json` and `package.json` together, update the version-specific download URL, and add a matching changelog entry. Run the checks, validate gameplay changes in an isolated licensed installation, then push an annotated `v<version>` tag. GitHub Actions creates the installable `module.zip`, `module.json` and `SHA256SUMS`. The GitHub source archive is not the module installation asset.

The build uses a five-file allowlist. Never add operation scripts, campaign exports, private tests, server configuration, licensed core/system files or raw artifacts to releases or the repository.

## Optional official directory listing

The package has not been submitted to or approved by Foundry. The license owner can use the [submission form](https://foundryvtt.com/creators/submit/):

- Type: Add-on Module
- ID: `pf2e-blood-magic-target-damage`
- Title: PF2e Blood Magic Target Damage
- Project: https://github.com/jjthibau/pf2e-blood-magic-target-damage
- Manifest: stable latest-release URL above
- License: MIT
- Compatibility: Foundry14.369/generation14; exactly PF2e8.6.0
- Suggested categories: Combat Enhancements, Automation Enhancers

The maintainer must personally make the submission's understanding/maintenance attestations and supply human-authored official description/UI wording as required by [Foundry's AI policy](https://foundryvtt.com/article/ai-policy/). This AI-assisted repository must not claim the Zero AI designation. Publication to GitHub is separate from that submission; no personal attestation is made by CI.
