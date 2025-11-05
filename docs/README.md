# Documentation

This directory contains the source files for the mdBook documentation.

## Building Locally

To build and preview the documentation locally:

1. **Install mdBook**:
   ```bash
   # Using cargo (Rust)
   cargo install mdbook
   
   # Or download from: https://github.com/rust-lang/mdBook/releases
   ```

2. **Build the documentation**:
   ```bash
   # From project root
   mdbook build
   ```

3. **Serve locally**:
   ```bash
   mdbook serve
   ```
   Then open http://localhost:3000

## Structure

- `src/` - Source Markdown files
- `book.toml` - Configuration file (in project root)
- `book/` - Generated output (created after build, gitignored)

## Adding New Pages

1. Add your Markdown file to the appropriate directory in `src/`
2. Update `src/SUMMARY.md` to include a link to your new page
3. The documentation will automatically rebuild on push to main via GitHub Actions

## Deployment

The documentation is automatically deployed to GitHub Pages when you push to the `main` branch. The site will be available at:

**https://spunsel.github.io/cpee-log-error-console/documentation/**

Note: The documentation is deployed to the `/documentation/` subdirectory to avoid conflicts with the main application, which is served from the root URL.
