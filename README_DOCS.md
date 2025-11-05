# Documentation Setup

This project uses [mdBook](https://rust-lang.github.io/mdBook/) for documentation.

## Quick Start

### Install mdBook

```bash
# Using cargo (requires Rust)
cargo install mdbook

# Or download from: https://github.com/rust-lang/mdBook/releases
```

### Build and Serve Locally

```bash
# From project root
mdbook build
mdbook serve
```

Then open http://localhost:3000

### View Online

Once deployed, the documentation will be available at:

**https://spunsel.github.io/cpee-log-error-console/documentation/**

> **Note**: The documentation is deployed to the `/documentation/` subdirectory to avoid conflicts with the main application, which is served from the root URL (`https://spunsel.github.io/cpee-log-error-console/`).

## Structure

- `book.toml` - Configuration file
- `docs/src/` - Source Markdown files
- `docs/book/` - Generated output (created after build, gitignored)

## Deployment

The documentation is automatically deployed to GitHub Pages via GitHub Actions when you push to the `main` branch.

## Adding Content

1. Add your Markdown file to the appropriate directory in `docs/src/`
2. Update `docs/src/SUMMARY.md` to include a link to your new page
3. Push to `main` - the documentation will automatically rebuild and deploy
