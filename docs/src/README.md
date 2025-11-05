# Documentation

This directory contains the source files for the mdBook documentation.

## Building Locally

To build and preview the documentation locally:

1. Install mdBook:
   ```bash
   cargo install mdbook
   ```
   Or download from: https://github.com/rust-lang/mdBook/releases

2. Build the documentation:
   ```bash
   cd docs
   mdbook build
   ```

3. Serve locally:
   ```bash
   mdbook serve
   ```
   Then open http://localhost:3000

## Structure

- `src/` - Source Markdown files
- `book.toml` - Configuration file (in project root)
- `book/` - Generated output (created after build)

## Adding New Pages

1. Add your Markdown file to the appropriate directory in `src/`
2. Update `src/SUMMARY.md` to include a link to your new page
3. The documentation will automatically rebuild on push to main

